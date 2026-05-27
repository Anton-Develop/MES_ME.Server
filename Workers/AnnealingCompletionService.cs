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
/// 
/// Статус "Закалка пройдена" присваивается ТОЛЬКО при выходе листа из зоны X1,
/// поскольку закалка = нагрев + контролируемое охлаждение.
/// </summary>
public class AnnealingCompletionService : BackgroundService
{
    private readonly IOpcUaService _opcService;
    private readonly IServiceProvider _services;
    private readonly ILogger<AnnealingCompletionService> _logger;
    private readonly NpgsqlDataSource _dataSource;
    private readonly IMemoryCache _completedCache; // Дедупликация завершения

    // ✅ Потокобезопасные коллекции (OPC UA события приходят из разных потоков)
    private readonly ConcurrentDictionary<string, bool> _lastZoneOccup = new();
    private readonly ConcurrentDictionary<string, string> _currentSheetInZone = new();

    // Семафоры по бизнес-ключу — защита от race condition при создании листа
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _businessKeyLocks = new();

    // Порядок зон по ходу движения листа
    private readonly string[] _zonesInOrder = { "E1", "F1", "F2", "F3", "F4", "X1", "X2" };

    private const string CachePrefix = "annealing_done:";
    private static readonly TimeSpan CompletionDeduplicationWindow = TimeSpan.FromMinutes(10);

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

    // ====================================================================
    // Жизненный цикл BackgroundService
    // ====================================================================
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("AnnealingCompletionService запускается...");
       // LogAvailableOpcTags(); 
        // Восстановление состояния после возможного перезапуска контейнера
        await RestoreStateFromOpcUaAsync();

        _opcService.ValueChanged += OnValueChanged;

        try
        {
            // Держим сервис живым до сигнала остановки
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // Штатное завершение
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
    // Восстановление состояния при старте (защита от потери листов при рестарте)
    // ====================================================================
    private async Task RestoreStateFromOpcUaAsync()
    {
        _logger.LogInformation("Восстановление состояния трекинга листов из OPC UA...");

        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Берём все активные листы из БД для возможной привязки к зонам
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
                var occupValue = _opcService.GetValue($"{zone}_ZoneOccup")?.Value;
                if (occupValue is not bool isOccupied || !isOccupied)
                {
                    _lastZoneOccup[zone] = false;
                    continue;
                }

                _lastZoneOccup[zone] = true;

                // Попытка 1: восстановить по бизнес-ключам из OPC UA
                var matId = await FindOrCreateSheetByBusinessKeyAsync(context, zone);

                // Попытка 2: если в БД только 1 активный лист и все зоны заняты — вероятно, он
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
                        "⚠️ Зона {Zone} занята (ZoneOccup=true), но восстановить MatId не удалось. " +
                        "При переходе в следующую зону сработает fallback.",
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
    // Главный обработчик событий (безопасная обёртка для async void)
    // ====================================================================
    private async void OnValueChanged(string alias, OpcUaValue value)
    {
        try
        {
            await ProcessZoneEventAsync(alias, value);
        }
        catch (Exception ex)
        {
            // Любое исключение логируется, но не убивает процесс
            _logger.LogError(ex, "Критическая ошибка в обработчике OPC UA для {Alias}", alias);
        }
    }

   private async Task ProcessZoneEventAsync(string alias, OpcUaValue value)
{
    // ✅ Патч 1: Поддерживаем оба варианта naming convention (ZoneOccup и Ocp)
    string zoneName;
    if (alias.EndsWith("_ZoneOccup"))
        zoneName = alias.Replace("_ZoneOccup", "");
    else if (alias.EndsWith("_Ocp"))
        zoneName = alias.Replace("_Ocp", "");
    else
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
        // ⏱️ Патч 2: КРИТИЧЕСКИ ВАЖНО для промышленных PLC!
        // Даём PLC время (1.5 секунды) обновить регистры трекинга (Melt, Sheet и т.д.)
        // и OPC UA серверу время опубликовать их в наш кэш.
        // Без этой задержки мы читаем "0" или "null" из-за гонки скан-циклов.
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

    // ====================================================================
    // ВХОД ЛИСТА В ЗОНУ
    // ====================================================================
    private async Task HandleSheetEnteredAsync(AppDbContext context, string zoneName)
{
    _logger.LogInformation("▶️ Лист ВОШЁЛ в зону {Zone}", zoneName);

    string? matId = null;

    // ✅ Стратегия 1: Берём MatId из предыдущей зоны (быстро и без БД)
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

    // ✅ Стратегия 2: Если в предыдущей зоне нет — читаем бизнес-ключи ТЕКУЩЕЙ зоны
    // (работает для ВСЕХ зон, включая F1-F4, X1, X2 — OPC UA отдаёт данные везде!)
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
            "❌ Не удалось определить MatId для зоны {Zone}. " +
            "Состояние зон: {State}",
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

        // MatId НЕ удаляем здесь — он удаляется при входе в следующую зону
        // (защита от race condition при одновременных событиях входа/выхода)

        // 🎯 КЛЮЧЕВОЙ МОМЕНТ: выход из X1 = завершение закалки
        if (zoneName == "X1" &&
            _currentSheetInZone.TryGetValue(zoneName, out var matId) &&
            !string.IsNullOrEmpty(matId))
        {
            // Дедупликация через IMemoryCache (защита от повторных событий)
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

        // Выход из X2 — финальная точка, лист полностью обработан
        if (zoneName == "X2" &&
            _currentSheetInZone.TryRemove(zoneName, out var finalMatId) &&
            !string.IsNullOrEmpty(finalMatId))
        {
            _logger.LogInformation("✅ Лист {MatId} покинул X2 — полностью обработан", finalMatId);
            await UpdateSheetStatusAsync(context, finalMatId, "Закалка пройдена, измерен");
        }
    }

    // ====================================================================
    // 🎯 ЗАВЕРШЕНИЕ ЗАКАЛКИ — главный метод бизнес-логики
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

            // ✅ Атомарное обновление — всё в одном SaveChanges
            sheet.Status = "Закалка пройдена";
            sheet.QuenchingDate = DateTime.UtcNow;
            sheet.QuenchingStatus = "Завершена";
            await context.SaveChangesAsync();

            _logger.LogInformation("✅ Лист {MatId}: статус 'Закалка пройдена', дата {Date}",
                matId, sheet.QuenchingDate);

            // Проверяем, не завершился ли план закалки
            await CheckAndCompletePlanAsync(context, matId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при завершении закалки для листа {MatId}", matId);
        }
    }

    // ====================================================================
    // Навигация по зонам
    // ====================================================================
    private string? GetPreviousZone(string currentZone)
    {
        var index = Array.IndexOf(_zonesInOrder, currentZone);
        return index > 0 ? _zonesInOrder[index - 1] : null;
    }

    // ====================================================================
    // Чтение значений из OPC UA Формирует alias по шаблону: {zoneName}_{field} (например, "F2_Melt")
    // ====================================================================
    private string? GetValueFromZone(string zoneName, string field)
{
    try
    {
        // Чистый alias без пробелов
        var alias = $"{zoneName}_{field}";
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

    // ====================================================================
    // Генерация MatId (через PostgreSQL sequence — атомарно и безопасно)
    // ====================================================================
    private async Task<string> GenerateNewMatIdAsync()
    {
        // ❌ Удалили опасный fallback через ToListAsync() всей таблицы
        // Sequence не должна падать. Если падает — это серьёзная проблема с БД.
        await using var connection = await _dataSource.OpenConnectionAsync();
        var nextVal = await connection.QueryFirstOrDefaultAsync<long>(
            "SELECT nextval('mes.matid_seq')");
        return nextVal.ToString();
    }

    // ====================================================================
    // Поиск или создание листа по бизнес-ключам
    // ✅ С защитой от race condition (SemaphoreSlim + обработка unique violation)
    // ====================================================================
    private async Task<string?> FindOrCreateSheetByBusinessKeyAsync(AppDbContext context, string zoneName)
    {
        var melt = GetValueFromZone(zoneName, "Melt");
        var partNo = GetValueFromZone(zoneName, "PartNo");
        var pack = GetValueFromZone(zoneName, "Pack");
        var sheet = GetValueFromZone(zoneName, "Sheet");

        _logger.LogInformation(
            "OPC UA данные для зоны {Zone}: Melt={Melt}, PartNo={PartNo}, Pack={Pack}, Sheet={Sheet}",
            zoneName, melt ?? "(null)", partNo ?? "(null)", pack ?? "(null)", sheet ?? "(null)");

        // ✅ Все 4 ключа ОБЯЗАТЕЛЬНЫ (было ||, стало &&)
        bool hasValidData = !string.IsNullOrEmpty(melt) && melt != "0" &&
                    !string.IsNullOrEmpty(partNo) && partNo != "0" &&
                    !string.IsNullOrEmpty(pack) && pack != "0" &&
                    !string.IsNullOrEmpty(sheet) && sheet != "0";

        if (!hasValidData)
        {
            _logger.LogWarning("Невалидные бизнес-ключи для зоны {Zone}", zoneName);
            return null;
        }

        // 🔒 Семафор по бизнес-ключу — защита от параллельного создания дубликатов
        var businessKey = $"{melt}_{partNo}_{pack}_{sheet}";
        var semaphore = _businessKeyLocks.GetOrAdd(businessKey, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync();

        try
        {
            // Ищем существующий лист
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

            // Создаём новый лист
            var steelGrade = GetValueFromZone(zoneName, "AlloyCode");
            var thickness = GetValueFromZone(zoneName, "Thickness"); // исправлено: было "Thikness"
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
                // Unique violation — кто-то параллельно создал этот же лист
                _logger.LogWarning(
                    "Лист с ключом {Key} был создан параллельным процессом, перечитываем",
                    businessKey);

                // Detach конфликтующую запись из EF Core change tracker
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

    // ====================================================================
    // Обновление статуса листа
    // ====================================================================
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

    // ====================================================================
    // Проверка завершения плана закалки (через JOIN — эффективно)
    // ====================================================================
    private async Task CheckAndCompletePlanAsync(AppDbContext context, string completedMatId)
    {
        try
        {
            var planLink = await context.AnnealingBatchPlanSheets
                .Include(l => l.BatchPlan)
                .FirstOrDefaultAsync(l => l.MatId == completedMatId && l.BatchPlan!.Status == "В работе");

            if (planLink?.BatchPlan == null) return;

            var plan = planLink.BatchPlan;

            // ✅ Используем JOIN вместо Contains (быстрее и масштабируемее)
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

    private void LogAvailableOpcTags()
{
    _logger.LogInformation("=== Диагностика OPC UA тегов ===");

    var testAliases = new[]
    {
        "E1_Melt", "E1_ZoneOccup",
        "F1_Melt", "F1_ZoneOccup",
        "F2_Melt", "F2_ZoneOccup",
        "F3_Melt", "F3_ZoneOccup",
        "F4_Melt", "F4_ZoneOccup",
        "X1_Melt", "X1_ZoneOccup",
        "X2_Melt", "X2_ZoneOccup"
    };

    foreach (var alias in testAliases)
    {
        var value = _opcService.GetValue(alias);
        _logger.LogInformation(
            "OPC тег {Alias}: {Status} (value={Value})",
            alias,
            value != null ? "✅ подписан" : "❌ не найден",
            value?.Value?.ToString() ?? "(null)");
    }

    _logger.LogInformation("=== Конец диагностики ===");
}
}