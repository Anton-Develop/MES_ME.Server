using MES_ME.Server.Data;
using MES_ME.Server.Models;
using MES_ME.Server.OpcUa;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Npgsql;
using Dapper;
using System.Collections.Concurrent;

namespace MES_ME.Server.Workers;

/// <summary>
/// Сервис отслеживания прохождения закалки листами через события OPC UA.
///
/// Бизнес-логика зон (одна печь):
///   E1 — входной рольганг перед печью
///   F1, F2, F3, F4 — зоны нагрева печи (собственно печь закалки)
///   X1 — зона ламинарного охлаждения (здесь metallurgically завершается закалка)
///   X2 — зона измерения планшетности (пост-контроль)
/// </summary>
public class AnnealingCompletionService : BackgroundService
{
    private readonly IOpcUaService _opcService;
    private readonly IServiceProvider _services;
    private readonly ILogger<AnnealingCompletionService> _logger;
    private readonly NpgsqlDataSource _dataSource;
    private readonly IMemoryCache _completedCache;

    private readonly ConcurrentDictionary<string, bool> _lastZoneOccup = new();
    private readonly ConcurrentDictionary<string, string> _currentSheetInZone = new();
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _businessKeyLocks = new();

    private readonly string[] _zonesInOrder = { "E1", "F1", "F2", "F3", "F4", "X1", "X2" };

    private const string CachePrefix = "annealing_done:";
    private static readonly TimeSpan CompletionDeduplicationWindow = TimeSpan.FromMinutes(10);

    // 🆕 КОНСТАНТА: имя контроллера для этой печи
    // Если завтра будет печь на PLC211 — создаём второй инстанс сервиса с "PLC211"
    private const string ControllerName = "PLC210";
    private const string ControllerPrefix = ControllerName + ".";

    public AnnealingCompletionService(
        IOpcUaService opcService,
        IServiceProvider services,
        ILogger<AnnealingCompletionService> logger,
        NpgsqlDataSource dataSource,
        IMemoryCache completedCache)
    {
        _opcService = opcService;
        _services = services;
        _logger = logger;
        _dataSource = dataSource;
        _completedCache = completedCache;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("AnnealingCompletionService запускается (controller={Controller})...", ControllerName);
        LogAvailableOpcTags();

        await RestoreStateFromOpcUaAsync();

        _opcService.ValueChanged += OnValueChanged;

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("AnnealingCompletionService останавливается...");
        _opcService.ValueChanged -= OnValueChanged;
        await base.StopAsync(cancellationToken);
    }

    public override void Dispose()
    {
        _opcService.ValueChanged -= OnValueChanged;
        base.Dispose();
    }

    // ====================================================================
    // Восстановление состояния при старте
    // ====================================================================
    private async Task RestoreStateFromOpcUaAsync()
    {
        _logger.LogInformation("Восстановление состояния трекинга листов из OPC UA...");

        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        List<InputDatum> activeSheets;
        try
        {
            activeSheets = await context.InputData
                .Where(s => s.QuenchingStatus == "В процессе"
                         || s.Status == "На входном рольганге"
                         || s.Status == "В печи закалки"
                         || s.Status == "В охлаждении")
                .ToListAsync();

            _logger.LogInformation("Найдено {Count} активных листов в БД для привязки", activeSheets.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Не удалось загрузить активные листы из БД");
            activeSheets = new List<InputDatum>();
        }

        foreach (var zone in _zonesInOrder)
        {
            try
            {
                // 🆕 Используем GetZoneAlias для корректного имени
                var occupValue = _opcService.GetValue(GetZoneAlias(zone, "ZoneOccup"))?.Value;
                if (occupValue is not bool isOccupied || !isOccupied)
                {
                    _lastZoneOccup[zone] = false;
                    continue;
                }

                _lastZoneOccup[zone] = true;

                var matId = await FindOrCreateSheetByBusinessKeyAsync(context, zone);

                if (string.IsNullOrEmpty(matId) && activeSheets.Count == 1)
                {
                    matId = activeSheets[0].MatId;
                    _logger.LogWarning(
                        "Бизнес-ключи недоступны, привязываем единственный активный лист {MatId} к зоне {Zone}",
                        matId, zone);
                }

                if (!string.IsNullOrEmpty(matId))
                {
                    _currentSheetInZone[zone] = matId;
                    _logger.LogInformation("✅ Восстановлен лист {MatId} в зоне {Zone}", matId, zone);
                }
                else
                {
                    _logger.LogWarning(
                        "⚠️ Зона {Zone} занята (ZoneOccup=true), но восстановить MatId не удалось.",
                        zone);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Ошибка восстановления состояния для зоны {Zone}", zone);
            }
        }
    }

    // ====================================================================
    // 🆕 ГЛАВНЫЙ ОБРАБОТЧИК — с фильтрацией по контроллеру!
    // ====================================================================
    private async void OnValueChanged(string alias, OpcUaValue value)
    {
        try
        {
            // 🆕 КРИТИЧНО: обрабатываем ТОЛЬКО теги нашего контроллера!
            if (!alias.StartsWith(ControllerPrefix))
                return;

            await ProcessZoneEventAsync(alias, value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Критическая ошибка в обработчике OPC UA для {Alias}", alias);
        }
    }

    private async Task ProcessZoneEventAsync(string alias, OpcUaValue value)
    {
        // 🆕 Извлекаем имя зоны из алиаса с префиксом
        // alias = "PLC210.F1_ZoneOccup"  →  zoneName = "F1"
        string? zoneName = TryExtractZoneName(alias);
        if (zoneName == null)
            return; // Это не тег занятости зоны

        bool currentOccup;
        try
        {
            currentOccup = Convert.ToBoolean(value.Value);
        }
        catch
        {
            return;
        }

        _lastZoneOccup.TryGetValue(zoneName, out var previousOccup);
        _lastZoneOccup[zoneName] = currentOccup;

        // ▶️ Лист ВОШЁЛ в зону
        if (!previousOccup && currentOccup)
        {
            // ⏱️ КРИТИЧЕСКИ ВАЖНО: ждём обновления бизнес-ключей в OPC UA
            await Task.Delay(1500);

            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await HandleSheetEnteredAsync(context, zoneName);
        }
        // ⏹️ Лист ПОКИНУЛ зону
        else if (previousOccup && !currentOccup)
        {
            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await HandleSheetExitedAsync(context, zoneName);
        }
    }

    // 🆕 Безопасное извлечение имени зоны из алиаса
    // "PLC210.F1_ZoneOccup" → "F1"
    // "PLC210.E1_Ocp"       → "E1"
    private string? TryExtractZoneName(string alias)
    {
        if (!alias.StartsWith(ControllerPrefix))
            return null;

        var withoutPrefix = alias.Substring(ControllerPrefix.Length); // "F1_ZoneOccup"

        if (withoutPrefix.EndsWith("_ZoneOccup"))
            return withoutPrefix.Replace("_ZoneOccup", "");

        if (withoutPrefix.EndsWith("_Ocp"))
            return withoutPrefix.Replace("_Ocp", "");

        return null;
    }

    // 🆕 Формирование полного алиаса с префиксом контроллера
    // GetZoneAlias("F1", "Melt") → "PLC210.F1_Melt"
    private static string GetZoneAlias(string zoneName, string field)
    {
        return $"{ControllerPrefix}{zoneName}_{field}";
    }

    // ====================================================================
    // ВХОД ЛИСТА В ЗОНУ
    // ====================================================================
    private async Task HandleSheetEnteredAsync(AppDbContext context, string zoneName)
    {
        _logger.LogInformation("▶️ Лист ВОШЁЛ в зону {Zone}", zoneName);
        string? matId = null;

        if (zoneName != "E1")
        {
            var previousZone = GetPreviousZone(zoneName);
            if (!string.IsNullOrEmpty(previousZone) &&
                _currentSheetInZone.TryRemove(previousZone, out var prevMatId))
            {
                matId = prevMatId;
                _logger.LogDebug("Лист {MatId} перемещён из {PrevZone} в {Zone}",
                    matId, previousZone, zoneName);
            }
        }

        if (string.IsNullOrEmpty(matId))
        {
            _logger.LogInformation(
                "MatId не найден в предыдущей зоне — читаем бизнес-ключи из зоны {Zone}",
                zoneName);

            matId = await FindOrCreateSheetByBusinessKeyAsync(context, zoneName);
        }

        if (string.IsNullOrEmpty(matId))
        {
            _logger.LogError(
                "❌ Не удалось определить MatId для зоны {Zone}. Состояние зон: {State}",
                zoneName,
                string.Join(", ", _currentSheetInZone.Select(kv => $"{kv.Key}={kv.Value}")));
            return;
        }

        _currentSheetInZone[zoneName] = matId;

        var newStatus = zoneName switch
        {
            "E1" => "На входном рольганге",
            "F1" or "F2" or "F3" or "F4" => "В печи закалки",
            "X1" => "В охлаждении",
            "X2" => "Измерение планшетности",
            _ => null
        };

        if (newStatus != null)
            await UpdateSheetStatusAsync(context, matId, newStatus);
    }

    // ====================================================================
    // ВЫХОД ЛИСТА ИЗ ЗОНЫ
    // ====================================================================
    private async Task HandleSheetExitedAsync(AppDbContext context, string zoneName)
    {
        _logger.LogInformation("⏹️ Лист ПОКИНУЛ зону {Zone}", zoneName);

        if (zoneName == "X1" &&
            _currentSheetInZone.TryGetValue(zoneName, out var matId) &&
            !string.IsNullOrEmpty(matId))
        {
            var cacheKey = $"{CachePrefix}{matId}";
            if (!_completedCache.TryGetValue(cacheKey, out _))
            {
                _completedCache.Set(cacheKey, true, CompletionDeduplicationWindow);
                _logger.LogInformation("🎯 Лист {MatId} покинул X1 — ЗАКАЛКА ЗАВЕРШЕНА", matId);
                await CompleteQuenchingAsync(matId);
            }
            else
            {
                _logger.LogDebug("Завершение листа {MatId} уже обработано (дедупликация)", matId);
            }
        }

        if (zoneName == "X2" &&
            _currentSheetInZone.TryRemove(zoneName, out var finalMatId) &&
            !string.IsNullOrEmpty(finalMatId))
        {
            _logger.LogInformation("✅ Лист {MatId} покинул X2 — полностью обработан", finalMatId);
            await UpdateSheetStatusAsync(context, finalMatId, "Закалка пройдена, измерен");
        }
    }

    // ====================================================================
    // 🎯 ЗАВЕРШЕНИЕ ЗАКАЛКИ
    // ====================================================================
    private async Task CompleteQuenchingAsync(string matId)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        try
        {
            var sheet = await context.InputData.FirstOrDefaultAsync(s => s.MatId == matId);
            if (sheet == null)
            {
                _logger.LogWarning("Лист {MatId} не найден для завершения закалки", matId);
                return;
            }
            if (sheet.Status == "Брак")
            {
                _logger.LogWarning(
                    "⚠ Лист {MatId} уже помечен как БРАК. Пропускаем автозавершение закалки.",
                    matId);
                return;
            }

            sheet.Status = "Закалка пройдена";
            sheet.QuenchingDate = DateTime.UtcNow;
            sheet.QuenchingStatus = "Завершена";
            await context.SaveChangesAsync();

            _logger.LogInformation("✅ Лист {MatId}: статус 'Закалка пройдена', дата {Date}",
                matId, sheet.QuenchingDate);

            await CheckAndCompletePlanAsync(context, matId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при завершении закалки для листа {MatId}", matId);
        }
    }

    private string? GetPreviousZone(string currentZone)
    {
        var index = Array.IndexOf(_zonesInOrder, currentZone);
        return index > 0 ? _zonesInOrder[index - 1] : null;
    }

    // ====================================================================
    // 🆕 Чтение значений из OPC UA — С ПРЕФИКСОМ КОНТРОЛЛЕРА
    // ====================================================================
    private string? GetValueFromZone(string zoneName, string field)
    {
        try
        {
            var alias = GetZoneAlias(zoneName, field);
            var opcValue = _opcService.GetValue(alias);
            if (opcValue == null)
            {
                _logger.LogDebug("OPC UA тег {Alias} не найден или не подписан", alias);
                return null;
            }

            var strValue = opcValue.Value?.ToString();

            if (string.IsNullOrEmpty(strValue) || strValue == "0")
            {
                _logger.LogDebug("OPC UA тег {Alias} = '{Value}' (пусто или ноль)", alias, strValue ?? "(null)");
                return null;
            }

            _logger.LogDebug("OPC UA тег {Alias} = {Value}", alias, strValue);
            return strValue;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ошибка чтения OPC UA тега {Zone}_{Field}", zoneName, field);
            return null;
        }
    }

    private async Task<string> GenerateNewMatIdAsync()
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        var nextVal = await connection.QueryFirstOrDefaultAsync<long>(
            "SELECT nextval('mes.matid_seq')");
       // Формат "D10" добавит ведущие нули (например, 123 -> "0000000123"), 
    // чтобы это полностью совпадало с LPAD в SQL-процедуре.
    return nextVal.ToString("D10"); 
    }

    private async Task<string?> FindOrCreateSheetByBusinessKeyAsync(AppDbContext context, string zoneName)
    {
        var melt = GetValueFromZone(zoneName, "Melt");
        var partNo = GetValueFromZone(zoneName, "PartNo");
        var pack = GetValueFromZone(zoneName, "Pack");
        var sheet = GetValueFromZone(zoneName, "Sheet");

        _logger.LogInformation(
            "OPC UA данные для зоны {Zone}: Melt={Melt}, PartNo={PartNo}, Pack={Pack}, Sheet={Sheet}",
            zoneName, melt ?? "(null)", partNo ?? "(null)", pack ?? "(null)", sheet ?? "(null)");

        bool hasValidData = !string.IsNullOrEmpty(melt) && melt != "0" &&
                    !string.IsNullOrEmpty(partNo) && partNo != "0" &&
                    !string.IsNullOrEmpty(pack) && pack != "0" &&
                    !string.IsNullOrEmpty(sheet) && sheet != "0";

        if (!hasValidData)
        {
            _logger.LogWarning("Невалидные бизнес-ключи для зоны {Zone}", zoneName);
            return null;
        }

        var businessKey = $"{melt}_{partNo}_{pack}_{sheet}";
        var semaphore = _businessKeyLocks.GetOrAdd(businessKey, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync();

        try
        {
            var existingSheet = await context.InputData
                .AsNoTracking()
                .FirstOrDefaultAsync(s =>
                    s.MeltNumber == melt &&
                    s.BatchNumber == partNo &&
                    s.PackNumber == pack &&
                    s.SheetNumber == sheet);

            if (existingSheet != null)
            {
                _logger.LogDebug("Найден существующий лист MatId={MatId}", existingSheet.MatId);
                return existingSheet.MatId;
            }

            var steelGrade = GetValueFromZone(zoneName, "AlloyCode");
            var thickness = GetValueFromZone(zoneName, "Thickness");
            var slabNumber = GetValueFromZone(zoneName, "Slab");
            var sheetInPack = GetValueFromZone(zoneName, "SheetInPack");

            var newMatId = await GenerateNewMatIdAsync();

            int sheetsCount = 1;
            if (!string.IsNullOrEmpty(sheetInPack) && int.TryParse(sheetInPack, out var sip))
                sheetsCount = sip;

            var now = DateTime.UtcNow;
            var newSheet = new InputDatum
            {
                MatId = newMatId,
                Status = "На входном рольганге",
                MeltNumber = melt,
                BatchNumber = partNo,
                PackNumber = pack,
                PackSystemNumber = pack,
                SheetNumber = sheet,
                SteelGrade = steelGrade,
                SheetDimensions = thickness,
                SlabNumber = slabNumber,
                SheetsCount = sheetsCount,
                RollDate = now,
                QuenchingStatus = "В процессе",
                QuenchingDate = now
            };

            context.InputData.Add(newSheet);

            try
            {
                await context.SaveChangesAsync();
                _logger.LogInformation(
                    "Создан новый лист MatId={MatId} для бизнес-ключа: {Melt}/{PartNo}/{Pack}/{Sheet}",
                    newMatId, melt, partNo, pack, sheet);
                return newMatId;
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                _logger.LogWarning(
                    "Лист с ключом {Key} был создан параллельным процессом, перечитываем",
                    businessKey);

                context.Entry(newSheet).State = EntityState.Detached;

                var concurrentSheet = await context.InputData
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s =>
                        s.MeltNumber == melt &&
                        s.BatchNumber == partNo &&
                        s.PackNumber == pack &&
                        s.SheetNumber == sheet);

                return concurrentSheet?.MatId;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при поиске/создании листа для зоны {Zone}", zoneName);
            return null;
        }
        finally
        {
            semaphore.Release();
        }
    }

    private async Task UpdateSheetStatusAsync(AppDbContext context, string matId, string newStatus)
    {
        try
        {
            var sheet = await context.InputData.FirstOrDefaultAsync(s => s.MatId == matId);
            if (sheet != null && sheet.Status != newStatus)
            {
                sheet.Status = newStatus;
                await context.SaveChangesAsync();
                _logger.LogInformation("Лист {MatId}: статус '{Status}'", matId, newStatus);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка обновления статуса листа {MatId}", matId);
        }
    }

    private async Task CheckAndCompletePlanAsync(AppDbContext context, string completedMatId)
    {
        try
        {
            var planLink = await context.AnnealingBatchPlanSheets
                .Include(l => l.BatchPlan)
                .FirstOrDefaultAsync(l => l.MatId == completedMatId && l.BatchPlan!.Status == "В работе");

            if (planLink?.BatchPlan == null) return;

            var plan = planLink.BatchPlan;

            var notCompletedCount = await (
                from input in context.InputData
                join link in context.AnnealingBatchPlanSheets on input.MatId equals link.MatId
                where link.PlanId == plan.PlanId
                    && input.Status != "Закалка пройдена"
                    && input.Status != "Закалка пройдена, измерен"
                select input
            ).CountAsync();

            if (notCompletedCount == 0)
            {
                plan.Status = "Завершён";
                plan.ActualEndTime = DateTimeOffset.UtcNow;
                await context.SaveChangesAsync();

                _logger.LogInformation(
                    "🎯 План закалки {PlanId} '{PlanName}' автоматически завершён",
                    plan.PlanId, plan.PlanName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка проверки завершения плана для листа {MatId}", completedMatId);
        }
    }

    // 🆕 Обновлённая диагностика — с префиксом контроллера
    private void LogAvailableOpcTags()
    {
        _logger.LogInformation("=== Диагностика OPC UA тегов для {Controller} ===", ControllerName);

        foreach (var zone in _zonesInOrder)
        {
            var meltAlias = GetZoneAlias(zone, "Melt");
            var occupAlias = GetZoneAlias(zone, "ZoneOccup");

            var melt = _opcService.GetValue(meltAlias);
            var occup = _opcService.GetValue(occupAlias);

            _logger.LogInformation(
                "Зона {Zone}: Melt={Melt} ({MeltVal}), ZoneOccup={Occup} ({OccupVal})",
                zone,
                melt != null ? "✅" : "❌",
                melt?.Value?.ToString() ?? "(null)",
                occup != null ? "✅" : "❌",
                occup?.Value?.ToString() ?? "(null)");
        }

        _logger.LogInformation("=== Конец диагностики ===");
    }
}