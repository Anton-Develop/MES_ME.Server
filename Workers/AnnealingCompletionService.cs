using MES_ME.Server.Data;
using MES_ME.Server.Models;
using MES_ME.Server.OpcUa;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Dapper;

namespace MES_ME.Server.Workers
{
    public class AnnealingCompletionService : BackgroundService
    {
        private readonly IOpcUaService _opcService;
        private readonly IServiceProvider _services;
        private readonly ILogger<AnnealingCompletionService> _logger;
        private readonly NpgsqlDataSource _dataSource;

        private readonly Dictionary<string, bool> _lastZoneOccup = new();
        private readonly Dictionary<string, string> _currentSheetInZone = new();
        private readonly HashSet<string> _completedSheets = new();
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
            if (!alias.EndsWith("_ZoneOccup")) return;

            var zoneName = alias.Replace("_ZoneOccup", "");
            var currentOccup = Convert.ToBoolean(value.Value);

            _lastZoneOccup.TryGetValue(zoneName, out var previousOccup);
            _lastZoneOccup[zoneName] = currentOccup;

            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Лист вошёл в зону
            if (!previousOccup && currentOccup)
            {
                _logger.LogDebug("Лист вошёл в зону {Zone}", zoneName);

                string? matId = null;

                if (zoneName == "E1")
                {
                    // Только при входе в E1 получаем бизнес-ключи и создаём/находим лист
                    matId = await FindOrCreateSheetByBusinessKeyAsync(context, zoneName);
                }
                else
                {
                    // Для остальных зон - берём MatId из предыдущей зоны
                    var previousZone = GetPreviousZone(zoneName);
                    if (!string.IsNullOrEmpty(previousZone) && _currentSheetInZone.TryGetValue(previousZone, out var prevMatId))
                    {
                        matId = prevMatId;
                        _logger.LogDebug("Лист {MatId} перемещён из зоны {PrevZone} в {Zone}", matId, previousZone, zoneName);
                    }
                }

                if (!string.IsNullOrEmpty(matId))
                {
                    _currentSheetInZone[zoneName] = matId;
                    _logger.LogDebug("Зона {Zone}: лист {MatId}", zoneName, matId);

                    // Обновляем статус в БД
                    if (zoneName == "E1")
                        await UpdateSheetStatusAsync(context, matId, "На входном рольганге");
                    else if (zoneName == "F1")
                        await UpdateSheetStatusAsync(context, matId, "В печи закалки");
                    else if (zoneName == "X1")
                        await UpdateSheetStatusAsync(context, matId, "В охлаждении");
                }
            }

            // Лист покинул зону
            if (previousOccup && !currentOccup)
            {
                _logger.LogDebug("Лист покинул зону {Zone}", zoneName);

                // Если лист покинул X1 - закалка завершена!
                if (zoneName == "X1")
                {
                    if (_currentSheetInZone.TryGetValue(zoneName, out var matId) && !string.IsNullOrEmpty(matId))
                    {
                        if (!_completedSheets.Contains(matId))
                        {
                            _completedSheets.Add(matId);
                            _logger.LogInformation("Лист {MatId} покинул зону X1 - закалка завершена", matId);
                            await CompleteSheetAsync(matId);

                            _ = Task.Run(async () =>
                            {
                                await Task.Delay(TimeSpan.FromMinutes(5));
                                _completedSheets.Remove(matId);
                            });
                        }
                        _currentSheetInZone.Remove(zoneName);
                    }
                }

                // Перемещаем лист в следующую зону
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
                    _currentSheetInZone.Remove(zoneName);
                }
            }
        }

        private string? GetPreviousZone(string currentZone)
        {
            var index = Array.IndexOf(_zonesInOrder, currentZone);
            return index > 0 ? _zonesInOrder[index - 1] : null;
        }

        private string? GetNextZone(string currentZone)
        {
            var index = Array.IndexOf(_zonesInOrder, currentZone);
            return index >= 0 && index < _zonesInOrder.Length - 1 ? _zonesInOrder[index + 1] : null;
        }

        /// <summary>
        /// Получает значение из OPC UA для чтения (использует алиасы E1_, F1_, X1_ и т.д.)
        /// </summary>
        private string? GetValueFromZone(string zoneName, string field)
        {
            try
            {
                var fieldMapping = field switch
                {
                    "Melt" => "Melt",
                    "PartNo" => "PartNo",
                    "Pack" => "Pack",
                    "Sheet" => "Sheet",
                    "AlloyCode" => "AlloyCode",
                    "Thikness" => "Thikness",
                    "Slab" => "Slab",
                    "SheetInPack" => "SheetInPack",
                    _ => field
                };

                var alias = $"{zoneName}_{fieldMapping}";
                var value = _opcService.GetValue(alias)?.Value?.ToString();

                if (!string.IsNullOrEmpty(value) && value != "0")
                {
                    _logger.LogDebug("Найдено значение {Alias} = {Value}", alias, value);
                    return value;
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Ошибка получения {Field} для зоны {Zone}", field, zoneName);
                return null;
            }
        }

        private async Task<string> GenerateNewMatIdAsync()
        {
            try
            {
                await using var connection = await _dataSource.OpenConnectionAsync();
                var nextVal = await connection.QueryFirstOrDefaultAsync<long>("SELECT nextval('mes.matid_seq')");
                return nextVal.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при получении следующего значения из последовательности matid_seq");

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

        private async Task<string?> FindOrCreateSheetByBusinessKeyAsync(AppDbContext context, string zoneName)
        {
            try
            {
                // Получаем бизнес-ключи из OPC UA (только для E1)
                var melt = GetValueFromZone(zoneName, "Melt");
                var partNo = GetValueFromZone(zoneName, "PartNo");
                var pack = GetValueFromZone(zoneName, "Pack");
                var sheet = GetValueFromZone(zoneName, "Sheet");

                _logger.LogInformation("OPC UA данные для зоны {Zone}: Melt={Melt}, PartNo={PartNo}, Pack={Pack}, Sheet={Sheet}",
                    zoneName, melt ?? "(null)", partNo ?? "(null)", pack ?? "(null)", sheet ?? "(null)");

                bool hasValidData = (!string.IsNullOrEmpty(melt) && melt != "0") ||
                                    (!string.IsNullOrEmpty(partNo) && partNo != "0") ||
                                    (!string.IsNullOrEmpty(pack) && pack != "0") ||
                                    (!string.IsNullOrEmpty(sheet) && sheet != "0");

                if (!hasValidData)
                {
                    _logger.LogWarning("Не удалось получить валидные бизнес-ключи для зоны {Zone}", zoneName);
                    return null;
                }

                // Ищем существующий лист
                var existingSheet = await context.InputData
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
                var thickness = GetValueFromZone(zoneName, "Thikness");
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

                _logger.LogInformation("Создан новый лист MatId={MatId} для бизнес-ключа: {Melt}/{PartNo}/{Pack}/{Sheet}",
                    newMatId, melt, partNo, pack, sheet);

                return newMatId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при поиске/создании листа для зоны {Zone}", zoneName);
                return null;
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
                    _logger.LogDebug("Лист {MatId}: статус обновлён на '{Status}'", matId, newStatus);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при обновлении статуса листа {MatId}", matId);
            }
        }

        private async Task CompleteSheetAsync(string matId)
        {
            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            try
            {
                await UpdateSheetStatusAsync(context, matId, "Закалка пройдена");

                var sheet = await context.InputData.FirstOrDefaultAsync(s => s.MatId == matId);
                if (sheet != null)
                {
                    sheet.QuenchingDate = DateTime.UtcNow;
                    sheet.QuenchingStatus = "Завершена";
                    await context.SaveChangesAsync();
                }

                _logger.LogInformation("Лист {MatId} успешно завершил закалку", matId);

                await CheckAndCompletePlanAsync(context, matId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при завершении закалки для листа {MatId}", matId);
            }
        }

        private async Task CheckAndCompletePlanAsync(AppDbContext context, string completedMatId)
        {
            try
            {
                var planLink = await context.AnnealingBatchPlanSheets
                    .Include(l => l.BatchPlan)
                    .FirstOrDefaultAsync(l => l.MatId == completedMatId && l.BatchPlan.Status == "В работе");

                if (planLink?.BatchPlan == null) return;

                var plan = planLink.BatchPlan;

                var allMatIdsInPlan = await context.AnnealingBatchPlanSheets
                    .Where(l => l.PlanId == plan.PlanId)
                    .Select(l => l.MatId)
                    .ToListAsync();

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