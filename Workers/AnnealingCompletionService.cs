using MES_ME.Server.Data;
using MES_ME.Server.Models;
using MES_ME.Server.OpcUa;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Dapper;

namespace MES_ME.Server.Workers
{
    /// <summary>
    /// Отслеживает прохождение листов через линию закалки.
    /// Лист считается прошедшим закалку, когда покидает зону X1 (охлаждение)
    /// </summary>
    public class AnnealingCompletionService : BackgroundService
    {
        private readonly IOpcUaService _opcService;
        private readonly IServiceProvider _services;
        private readonly ILogger<AnnealingCompletionService> _logger;
        private readonly NpgsqlDataSource _dataSource;
        
        // Храним предыдущие состояния зон
        private readonly Dictionary<string, bool> _lastZoneOccup = new();
        
        // Храним MatId листа в каждой зоне (числовой, без префикса)
        private readonly Dictionary<string, string> _currentSheetInZone = new();
        
        // Для защиты от повторного завершения одного листа
        private readonly HashSet<string> _completedSheets = new();
        
        // Порядок прохождения зон
        private readonly string[] _zonesInOrder = { "E1", "F1", "F2", "F3", "F4", "X1", "X2" };

        public AnnealingCompletionService(
            IOpcUaService opcService,
            IServiceProvider services,
            ILogger<AnnealingCompletionService> logger,
            NpgsqlDataSource dataSource)
        {
            _opcService = opcService;
            _services = services;
            _logger = logger;
            _dataSource = dataSource;
        }

        protected override Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _opcService.ValueChanged += OnValueChanged;
            return Task.CompletedTask;
        }

        private async void OnValueChanged(string alias, OpcUaValue value)
        {
            // Нас интересуют только теги ZoneOccup
            if (!alias.EndsWith("_ZoneOccup")) return;
            
            var zoneName = alias.Replace("_ZoneOccup", "");
            var currentOccup = Convert.ToBoolean(value.Value);
            
            _lastZoneOccup.TryGetValue(zoneName, out var previousOccup);
            _lastZoneOccup[zoneName] = currentOccup;

            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // ========== ЛИСТ ВОШЁЛ В ЗОНУ ==========
            if (!previousOccup && currentOccup)
            {
                _logger.LogDebug("Лист вошёл в зону {Zone}", zoneName);
                
                string? matId = null;
                
                // Для зоны E1 - получаем бизнес-ключи из OPC UA и находим/создаём лист
                if (zoneName == "E1")
                {
                    matId = await FindOrCreateSheetByBusinessKeyAsync(context, zoneName);
                }
                // Для остальных зон - пытаемся получить MatId из предыдущей зоны
                else
                {
                    var previousZone = GetPreviousZone(zoneName);
                    if (!string.IsNullOrEmpty(previousZone) && _currentSheetInZone.TryGetValue(previousZone, out var prevMatId))
                    {
                        matId = prevMatId;
                        _logger.LogDebug("Лист {MatId} перемещён из зоны {PrevZone} в {Zone}", matId, previousZone, zoneName);
                    }
                    else
                    {
                        // Если не нашли в предыдущей зоне, пробуем получить бизнес-ключи из текущей зоны
                        matId = await FindOrCreateSheetByBusinessKeyAsync(context, zoneName);
                    }
                }
                
                if (!string.IsNullOrEmpty(matId))
                {
                    _currentSheetInZone[zoneName] = matId;
                    _logger.LogDebug("Зона {Zone}: лист {MatId}", zoneName, matId);
                    
                    // Обновляем статус в БД при входе в ключевые зоны
                    if (zoneName == "E1")
                    {
                        await UpdateSheetStatusAsync(context, matId, "На входном рольганге");
                    }
                    else if (zoneName == "F1")
                    {
                        await UpdateSheetStatusAsync(context, matId, "В печи закалки");
                    }
                    else if (zoneName == "X1")
                    {
                        await UpdateSheetStatusAsync(context, matId, "В охлаждении");
                    }
                }
            }
            
            // ========== ЛИСТ ПОКИНУЛ ЗОНУ ==========
            if (previousOccup && !currentOccup)
            {
                _logger.LogDebug("Лист покинул зону {Zone}", zoneName);
                
                // Если лист покинул X1 - закалка завершена!
                if (zoneName == "X1")
                {
                    if (_currentSheetInZone.TryGetValue(zoneName, out var matId) && !string.IsNullOrEmpty(matId))
                    {
                        // Проверяем, не завершали ли уже этот лист
                        if (!_completedSheets.Contains(matId))
                        {
                            _completedSheets.Add(matId);
                            _logger.LogInformation("Лист {MatId} покинул зону X1 - закалка завершена", matId);
                            await CompleteSheetAsync(matId);
                            
                            // Очищаем из кэша через 5 минут
                            _ = Task.Run(async () =>
                            {
                                await Task.Delay(TimeSpan.FromMinutes(5));
                                _completedSheets.Remove(matId);
                            });
                        }
                        
                        _currentSheetInZone.Remove(zoneName);
                    }
                }
                
                // Перемещаем данные листа в следующую зону
                var nextZone = GetNextZone(zoneName);
                if (!string.IsNullOrEmpty(nextZone))
                {
                    if (_currentSheetInZone.TryGetValue(zoneName, out var matId))
                    {
                        _currentSheetInZone[nextZone] = matId;
                        _currentSheetInZone.Remove(zoneName);
                        _logger.LogDebug("Лист {MatId} перемещён из {Zone} в {NextZone}", matId, zoneName, nextZone);
                    }
                }
                else
                {
                    // Если это последняя зона (X2) - просто удаляем
                    _currentSheetInZone.Remove(zoneName);
                }
            }
        }

        /// <summary>
        /// Возвращает предыдущую зону в порядке прохождения
        /// </summary>
        private string? GetPreviousZone(string currentZone)
        {
            var index = Array.IndexOf(_zonesInOrder, currentZone);
            if (index > 0)
                return _zonesInOrder[index - 1];
            return null;
        }

        /// <summary>
        /// Возвращает следующую зону в порядке прохождения
        /// </summary>
        private string? GetNextZone(string currentZone)
        {
            var index = Array.IndexOf(_zonesInOrder, currentZone);
            if (index >= 0 && index < _zonesInOrder.Length - 1)
                return _zonesInOrder[index + 1];
            return null;
        }

        /// <summary>
        /// Получает значение из OPC UA для указанной зоны
        /// </summary>
       /// <summary>
/// Получает значение из OPC UA для указанной зоны
/// </summary>
private string? GetValueFromZone(string zoneName, string field)
{
    try
    {
        // Маппинг полей
        var fieldMapping = field switch
        {
            "Melt" => new[] { "Melt", "MeltNumber" },
            "PartNo" => new[] { "PartNo", "BatchNumber" },
            "Pack" => new[] { "Pack", "PackNumber" },
            "Sheet" => new[] { "Sheet", "SheetNumber" },
            "AlloyCode" => new[] { "AlloyCode", "SteelGrade", "AlloyCodeText" },
            "Thikness" => new[] { "Thikness", "Thickness", "SheetDimensions" },
            "Slab" => new[] { "Slab", "SlabNumber" },
            "SheetInPack" => new[] { "SheetInPack", "SheetsCount" },
            _ => new[] { field }
        };
        
        // Список возможных префиксов для алиасов
        string[] prefixes;
        
        if (zoneName == "E1")
        {
            prefixes = new[] { "EntrPlateData_", "E1_" };
        }
        else
        {
            prefixes = new[] { $"{zoneName}_" };
        }
        
        // Перебираем все комбинации префиксов и вариантов полей
        foreach (var prefix in prefixes)
        {
            foreach (var fieldVariant in fieldMapping)
            {
                var alias = $"{prefix}{fieldVariant}";
                var value = _opcService.GetValue(alias)?.Value?.ToString();
                
                // Игнорируем null, пустые строки и "0"
                if (!string.IsNullOrEmpty(value) && value != "0")
                {
                    _logger.LogDebug("Найдено значение {Alias} = {Value}", alias, value);
                    return value;
                }
            }
        }
        
        return null;
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Ошибка получения {Field} для зоны {Zone}", field, zoneName);
        return null;
    }
}

        /// <summary>
        /// Генерирует новый MatId из последовательности в БД
        /// </summary>
        private async Task<string> GenerateNewMatIdAsync()
        {
            try
            {
                await using var connection = await _dataSource.OpenConnectionAsync();
                
                // Получаем следующее значение из последовательности
                var nextVal = await connection.QueryFirstOrDefaultAsync<long>("SELECT nextval('mes.matid_seq')");
                
                // Возвращаем как строку (varchar(10) в БД)
                return nextVal.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при получении следующего значения из последовательности matid_seq");
                
                // Fallback: если последовательность не работает, используем максимальное значение + 1
                using var scope = _services.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                
                var maxMatId = await context.InputData
                    .Where(s => !string.IsNullOrEmpty(s.MatId))
                    .Select(s => s.MatId)
                    .ToListAsync();
                
                int maxNumber = 0;
                foreach (var matId in maxMatId)
                {
                    if (int.TryParse(matId, out int num) && num > maxNumber)
                        maxNumber = num;
                }
                
                return (maxNumber + 1).ToString();
            }
        }

        /// <summary>
        /// Находит или создаёт лист по бизнес-ключам из OPC UA
        /// </summary>
        private async Task<string?> FindOrCreateSheetByBusinessKeyAsync(AppDbContext context, string zoneName)
        {
            try
            {
                // Получаем бизнес-ключи из OPC UA
                var melt = GetValueFromZone(zoneName, "Melt");
                var partNo = GetValueFromZone(zoneName, "PartNo");
                var pack = GetValueFromZone(zoneName, "Pack");
                var sheet = GetValueFromZone(zoneName, "Sheet");
                
                // Логируем полученные значения для отладки
                _logger.LogInformation("OPC UA данные для зоны {Zone}: Melt={Melt}, PartNo={PartNo}, Pack={Pack}, Sheet={Sheet}", 
                    zoneName, melt ?? "(null)", partNo ?? "(null)", pack ?? "(null)", sheet ?? "(null)");
                
                   // Если все значения "0" или null - не можем идентифицировать лист
                    bool hasValidData = (!string.IsNullOrEmpty(melt) && melt != "0") ||
                                        (!string.IsNullOrEmpty(partNo) && partNo != "0") ||
                                        (!string.IsNullOrEmpty(pack) && pack != "0") ||
                                        (!string.IsNullOrEmpty(sheet) && sheet != "0");
                    
                    if (!hasValidData)
                    {
                        _logger.LogWarning("Не удалось получить валидные бизнес-ключи для зоны {Zone} (все значения = 0 или null)", zoneName);
                        return null;
                    }
                
               // Пытаемся найти существующий лист по бизнес-ключам
        var existingSheet = await context.InputData
            .FirstOrDefaultAsync(s => 
                (string.IsNullOrEmpty(melt) || melt == "0" || s.MeltNumber == melt) &&
                (string.IsNullOrEmpty(partNo) || partNo == "0" || s.BatchNumber == partNo) &&
                (string.IsNullOrEmpty(pack) || pack == "0" || s.PackNumber == pack) &&
                (string.IsNullOrEmpty(sheet) || sheet == "0" || s.SheetNumber == sheet));
                
               if (existingSheet != null)
                {
                    _logger.LogDebug("Найден существующий лист MatId={MatId} по бизнес-ключам", existingSheet.MatId);
                    return existingSheet.MatId;
                }
                
                // === СОЗДАЁМ НОВЫЙ ЛИСТ, ТАК КАК НЕ НАШЛИ ===
                
                // Получаем дополнительные данные из OPC UA
                var steelGrade = GetValueFromZone(zoneName, "AlloyCode");
                var thickness = GetValueFromZone(zoneName, "Thikness");
                var slabNumber = GetValueFromZone(zoneName, "Slab");
                var sheetInPack = GetValueFromZone(zoneName, "SheetInPack");
                
                // Генерируем новый MatId из SEQUENCE
                var newMatId = await GenerateNewMatIdAsync();
                
                // Парсим количество листов в пачке
                int sheetsCount = 1;
                if (!string.IsNullOrEmpty(sheetInPack) && int.TryParse(sheetInPack, out var sip))
                    sheetsCount = sip;
                
                var now = DateTime.UtcNow;
                
                var newSheet = new InputDatum
                {
                    MatId = newMatId,
                    Status = "В процессе закалки",
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
                await context.SaveChangesAsync();
                
                _logger.LogInformation("Создан новый лист MatId={MatId} (из SEQUENCE) для бизнес-ключа: {Melt}/{PartNo}/{Pack}/{Sheet}", 
                    newMatId, melt, partNo, pack, sheet);
                
                return newMatId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при поиске/создании листа для зоны {Zone}", zoneName);
                return null;
            }
        }

        /// <summary>
        /// Обновляет статус листа в БД
        /// </summary>
        private async Task UpdateSheetStatusAsync(AppDbContext context, string matId, string newStatus)
        {
            try
            {
                var sheet = await context.InputData.FirstOrDefaultAsync(s => s.MatId == matId);
                if (sheet != null && sheet.Status != newStatus)
                {
                    sheet.Status = newStatus;
                    await context.SaveChangesAsync();
                    _logger.LogDebug("Лист {MatId}: статус обновлён на '{Status}'", matId, newStatus);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при обновлении статуса листа {MatId}", matId);
            }
        }

        /// <summary>
        /// Завершает закалку для листа
        /// </summary>
        private async Task CompleteSheetAsync(string matId)
        {
            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            
            try
            {
                // Обновляем статус листа
                await UpdateSheetStatusAsync(context, matId, "Закалка пройдена");
                
                // Обновляем дату закалки
                var sheet = await context.InputData.FirstOrDefaultAsync(s => s.MatId == matId);
                if (sheet != null)
                {
                    sheet.QuenchingDate = DateTime.UtcNow;
                    sheet.QuenchingStatus = "Завершена";
                    await context.SaveChangesAsync();
                }
                
                _logger.LogInformation("Лист {MatId} успешно завершил закалку", matId);
                
                // Проверяем и завершаем план закалки
                await CheckAndCompletePlanAsync(context, matId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при завершении закалки для листа {MatId}", matId);
            }
        }

        /// <summary>
        /// Проверяет, все ли листы в плане закалки завершены
        /// </summary>
        private async Task CheckAndCompletePlanAsync(AppDbContext context, string completedMatId)
        {
            try
            {
                // Находим активный план, содержащий этот лист
                var planLink = await context.AnnealingBatchPlanSheets
                    .Include(l => l.BatchPlan)
                    .FirstOrDefaultAsync(l => l.MatId == completedMatId && l.BatchPlan.Status == "В работе");
                
                if (planLink?.BatchPlan == null) return;
                
                var plan = planLink.BatchPlan;
                
                // Получаем все MatId листов в этом плане
                var allMatIdsInPlan = await context.AnnealingBatchPlanSheets
                    .Where(l => l.PlanId == plan.PlanId)
                    .Select(l => l.MatId)
                    .ToListAsync();
                
                // Проверяем, все ли имеют статус "Закалка пройдена"
                var notCompletedCount = await context.InputData
                    .CountAsync(s => allMatIdsInPlan.Contains(s.MatId) && s.Status != "Закалка пройдена");
                
                if (notCompletedCount == 0)
                {
                    plan.Status = "Завершён";
                    plan.ActualEndTime = DateTimeOffset.UtcNow;
                    await context.SaveChangesAsync();
                    
                    _logger.LogInformation("План закалки {PlanId} '{PlanName}' автоматически завершён", 
                        plan.PlanId, plan.PlanName);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при проверке завершения плана");
            }
        }

        public override void Dispose()
        {
            _opcService.ValueChanged -= OnValueChanged;
            base.Dispose();
        }
    }
}