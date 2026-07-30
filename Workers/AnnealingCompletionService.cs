using MES_ME.Server.Data;
using MES_ME.Server.Models;
using MES_ME.Server.OpcUa;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Npgsql;
using Dapper;
using System.Collections.Concurrent;
using MES_ME.Server.Hubs;
using Microsoft.AspNetCore.SignalR;

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
    private readonly IHubContext<MeasurementHub> _measurementHub;

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
        IMemoryCache completedCache,IHubContext<MeasurementHub> measurementHub)
    {
        _opcService = opcService;
        _services = services;
        _logger = logger;
        _dataSource = dataSource;
        _completedCache = completedCache;
        _measurementHub = measurementHub;
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
                     || s.Status == "В охлаждении"
                     || s.Status == "Измерение планшетности")
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

                // ❌ Убираем создание записи измерения при восстановлении X2
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
        string? zoneName = TryExtractZoneName(alias);
        if (zoneName == null)
            return;

        bool currentOccup;
        try
        {
            if (zoneName == "X2")
            {
                // 🆕 Для X2: зона занята, если Sheet > 0
                var sheetValue = Convert.ToInt32(value.Value);
                currentOccup = sheetValue > 0;
                _logger.LogDebug("X2_Sheet = {Sheet}, occupied = {Occup}", sheetValue, currentOccup);
            }
            else
            {
                // Для остальных зон: стандартный Boolean
                currentOccup = Convert.ToBoolean(value.Value);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Не удалось преобразовать значение {Value} для зоны {Zone}", value.Value, zoneName);
            return;
        }

        _lastZoneOccup.TryGetValue(zoneName, out var previousOccup);
        _lastZoneOccup[zoneName] = currentOccup;

        // ▶️ Лист ВОШЁЛ в зону
        if (!previousOccup && currentOccup)
        {
            _logger.LogInformation("▶️ Лист ВОШЁЛ в зону {Zone}", zoneName);
            
            // ⏱️ КРИТИЧЕСКИ ВАЖНО: ждём обновления бизнес-ключей в OPC UA
            await Task.Delay(1500);

            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await HandleSheetEnteredAsync(context, zoneName);
        }
        // ⏹️ Лист ПОКИНУЛ зону
        else if (previousOccup && !currentOccup)
        {
            _logger.LogInformation("⏹️ Лист ПОКИНУЛ зону {Zone}", zoneName);
            
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

        var withoutPrefix = alias.Substring(ControllerPrefix.Length);

        // Стандартные теги занятости
        if (withoutPrefix.EndsWith("_ZoneOccup"))
            return withoutPrefix.Replace("_ZoneOccup", "");

        if (withoutPrefix.EndsWith("_Ocp"))
            return withoutPrefix.Replace("_Ocp", "");

        // 🆕 Для X2: определяем по тегу Sheet (так как ZoneOccup не меняется)
        if (withoutPrefix == "X2_Sheet")
            return "X2";

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
        _logger.LogError("❌ Не удалось определить MatId для зоны {Zone}. Состояние зон: {State}",
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
    
    // ❌ Убираем создание записи измерения при входе в X2
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
            
            // 🆕 Создаём запись измерения сразу после завершения закалки
            _logger.LogInformation("📏 Создаём запись измерения планшетности для листа {MatId}", matId);
            await CreateSheetMeasurementAsync(context, matId);
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
// 🆕 СОЗДАНИЕ ЗАПИСИ ИЗМЕРЕНИЯ ПЛАНШЕТНОСТИ (после завершения закалки)
// ====================================================================

        /// <summary>
        /// Определяет текущий номер повторного нагрева листа по plc.heating_sessions.
        /// Возвращает 0, если сессий ещё нет (первый проход).
        /// </summary>
        private async Task<int> GetCurrentReheatNumAsync(
            NpgsqlConnection con, int? melt, int? partNo, int? pack, int sheet)
        {
            if (melt is null || partNo is null || pack is null) return -1;

            var rn = await con.QueryFirstOrDefaultAsync<int?>(
                @"SELECT MAX(reheat_num)
                    FROM plc.heating_sessions
                WHERE melt    = @Melt
                    AND part_no = @Part
                    AND pack    = @Pack
                    AND sheet   = @Sheet",
                new { Melt = melt.Value, Part = partNo.Value, Pack = pack.Value, Sheet = sheet });
            return rn ?? -1;
        }
private async Task CreateSheetMeasurementAsync(AppDbContext context, string matId)
{
    try
    {
        var sheet = await context.InputData.AsNoTracking()
                        .FirstOrDefaultAsync(s => s.MatId == matId);
        if (sheet == null)
        {
            _logger.LogError("❌ Лист {MatId} не найден в БД", matId);
            return;
        }

        int? melt = int.TryParse(sheet.MeltNumber, out var m) ? m : null;
        int? partNo = int.TryParse(sheet.BatchNumber, out var p) ? p : null;
        int? pack = int.TryParse(sheet.PackNumber, out var pk) ? pk : null;
        int sheetNum = int.TryParse(sheet.SheetNumber, out var s) ? s : 0;

        await using var con = await _dataSource.OpenConnectionAsync();
            // Что уже знает таблица heating_sessions
            int sessionMax = await GetCurrentReheatNumAsync(con, melt, partNo, pack, sheetNum);
            // Что уже есть в измерениях листа
            int measurementMax = await context.Set<SheetMeasurement>()
                .AsNoTracking()
                .Where(sm => sm.MatId == matId)
                .MaxAsync(sm => (int?)sm.ReheatNum) ?? -1;

            // int reheatNum = await GetCurrentReheatNumAsync(con, melt, partNo, pack, sheetNum);
            // Если heating_sessions уже знает более новый нагрев — берём его.
            // Если heating_sessions ещё отстаёт — считаем следующий нагрев по измерениям.
            int reheatNum = Math.Max(sessionMax, measurementMax + 1);

            // Дедупликация по новому уникальному ключу
            var exists = await context.Set<SheetMeasurement>()
                 .AsNoTracking()
                 .AnyAsync(sm => sm.MatId == matId && sm.ReheatNum == reheatNum);
            if (exists)
        {
            _logger.LogWarning(
                "Запись измерения {MatId} reheat_num={Reheat} уже существует",
                matId, reheatNum);
            return;
        }

        var measurement = new SheetMeasurement
        {
            MatId         = matId,
            Melt          = melt,
            PartNo        = partNo,
            Pack          = pack,
            Sheet         = sheetNum,
            Slab          = int.TryParse(sheet.SlabNumber, out var sl) ? sl : null,
            Thickness     = float.TryParse(sheet.SheetDimensions, out var th) ? th : null,
            AlloyCodeText = sheet.SteelGrade,
            SheetsInPack  = sheet.SheetsCount,
            ReheatNum     = reheatNum,
            EnteredX2At   = DateTime.UtcNow,
            CreatedAt     = DateTime.UtcNow,
        };

        context.Set<SheetMeasurement>().Add(measurement);
        await context.SaveChangesAsync();

        _logger.LogInformation(
            "✅ Создана запись измерения {MatId} reheat_num={Reheat} (Id={Id})",
            matId, reheatNum, measurement.Id);

        await _measurementHub.Clients.Group("queue").SendAsync("NewMeasurement", new
        {
            id = measurement.Id,
            matId = measurement.MatId,
            melt = measurement.Melt,
            sheet = measurement.Sheet,
            partNo = measurement.PartNo,
            pack = measurement.Pack,
            reheatNum = measurement.ReheatNum,
            enteredX2At = measurement.EnteredX2At
        });
    }
    catch (PostgresException ex) when (ex.SqlState == "23505")
    {
        _logger.LogWarning(
            "Параллельное создание записи измерения для {MatId} — конфликт уникальности", matId);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "❌ Ошибка создания записи измерения для {MatId}", matId);
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

   // ====================================================================
// 🆕 СОЗДАНИЕ ЗАПИСИ ИЗМЕРЕНИЯ ПЛАНШЕТНОСТИ (при входе в X2)
// ====================================================================
    private async Task CreateSheetMeasurementAsync(AppDbContext context, string matId, string zoneName)
    {
        _logger.LogInformation("🔍 Начало CreateSheetMeasurementAsync для MatId={MatId}", matId);
        
        try
        {
            var exists = await context.Set<SheetMeasurement>()
                .AnyAsync(sm => sm.MatId == matId);
            
            if (exists)
            {
                _logger.LogWarning("⚠️ Запись измерения для листа {MatId} уже существует (дедупликация)", matId);
                return;
            }

            var melt        = GetValueFromZone(zoneName, "Melt");
            var partNo      = GetValueFromZone(zoneName, "PartNo");
            var pack        = GetValueFromZone(zoneName, "Pack");
            var sheetNum    = GetValueFromZone(zoneName, "Sheet");
            var slab        = GetValueFromZone(zoneName, "Slab");
            var thickness   = GetValueFromZone(zoneName, "Thickness");
            var alloyCode   = GetValueFromZone(zoneName, "AlloyCodeText");
            var sheetInPack = GetValueFromZone(zoneName, "SheetInPack");
            var sheetsInPack= GetValueFromZone(zoneName, "SheetsInPack");

            _logger.LogInformation(
                "📊 OPC UA данные для X2: Melt={Melt}, PartNo={PartNo}, Pack={Pack}, Sheet={Sheet}",
                melt ?? "(null)", partNo ?? "(null)", pack ?? "(null)", sheetNum ?? "(null)");

            if (string.IsNullOrEmpty(melt) || melt == "0" ||
                string.IsNullOrEmpty(sheetNum) || sheetNum == "0" ||
                string.IsNullOrEmpty(pack) || pack == "0" ||
                string.IsNullOrEmpty(partNo) || partNo == "0")
            {
                _logger.LogError(
                    "❌ Невалидные бизнес-ключи для X2: Melt={Melt}, PartNo={PartNo}, Pack={Pack}, Sheet={Sheet}. Запись не создана.",
                    melt, partNo, pack, sheetNum);
                return;
            }

            var measurement = new SheetMeasurement
            {
                MatId         = matId,
                Melt          = int.TryParse(melt, out var m) ? m : null,
                PartNo        = int.TryParse(partNo, out var p) ? p : null,
                Pack          = int.TryParse(pack, out var pk) ? pk : null,
                Sheet         = int.TryParse(sheetNum, out var s) ? s : 0,
                Slab          = int.TryParse(slab, out var sl) ? sl : 0,
                Thickness     = float.TryParse(thickness, out var th) ? th : null,
                AlloyCodeText = alloyCode,
                SheetInPack   = int.TryParse(sheetInPack, out var sip) ? sip : null,
                SheetsInPack  = int.TryParse(sheetsInPack, out var sipp) ? sipp : null,
                EnteredX2At   = DateTime.UtcNow,
                CreatedAt     = DateTime.UtcNow,
            };

            context.Set<SheetMeasurement>().Add(measurement);
            await context.SaveChangesAsync();

            _logger.LogInformation(
                "✅ Создана запись измерения для листа {MatId} (Id={Id}, Melt={Melt}, Sheet={Sheet})",
                matId, measurement.Id, measurement.Melt, measurement.Sheet);

            await _measurementHub.Clients.Group("queue").SendAsync("NewMeasurement", new
            {
                id = measurement.Id,
                matId = measurement.MatId,
                melt = measurement.Melt,
                sheet = measurement.Sheet,
                partNo = measurement.PartNo,
                pack = measurement.Pack,
                enteredX2At = measurement.EnteredX2At
            });
            
            _logger.LogInformation("📡 Уведомление SignalR отправлено для листа {MatId}", matId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Ошибка создания записи измерения для листа {MatId}", matId);
        }
    }
}