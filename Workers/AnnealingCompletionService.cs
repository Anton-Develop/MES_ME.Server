using MES_ME.Server.Data;
using MES_ME.Server.OpcUa;
using Microsoft.EntityFrameworkCore;

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

        // Храним предыдущие состояния зон
        private readonly Dictionary<string, bool> _lastZoneOccup = new();

        // Храним MatId листа в каждой зоне
        private readonly Dictionary<string, string> _currentSheetInZone = new();

        // Для защиты от повторного завершения одного листа
        private readonly HashSet<string> _completedSheets = new();

        public AnnealingCompletionService(
            IOpcUaService opcService,
            IServiceProvider services,
            ILogger<AnnealingCompletionService> logger)
        {
            _opcService = opcService;
            _services = services;
            _logger = logger;
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

            // --- Лист вошёл в зону ---
            if (!previousOccup && currentOccup)
            {
                _logger.LogDebug("Лист вошёл в зону {Zone}", zoneName);

                var matId = await FindMatIdByBusinessKeyAsync(context, zoneName);
                if (!string.IsNullOrEmpty(matId))
                {
                    _currentSheetInZone[zoneName] = matId;
                    _logger.LogDebug("Зона {Zone}: лист {MatId}", zoneName, matId);

                    // Если лист вошёл в X1, обновляем статус в БД
                    if (zoneName == "X1")
                    {
                        await UpdateSheetStatusAsync(context, matId, "В охлаждении");
                    }
                }
            }

            // --- Лист покинул зону ---
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

                // Перемещаем данные листа в следующую зону (если знаем)
                MoveSheetToNextZone(zoneName);
            }
        }

        /// <summary>
        /// Находит MatId по бизнес-ключам из OPC UA
        /// </summary>
        private async Task<string?> FindMatIdByBusinessKeyAsync(AppDbContext context, string zoneName)
        {
            try
            {
                // Получаем бизнес-ключи из OPC UA
                var melt = GetValueFromZone(zoneName, "Melt");
                var partNo = GetValueFromZone(zoneName, "PartNo");
                var pack = GetValueFromZone(zoneName, "Pack");
                var sheet = GetValueFromZone(zoneName, "Sheet");

                if (string.IsNullOrEmpty(melt) && string.IsNullOrEmpty(sheet))
                    return null;

                // Ищем лист по бизнес-ключам
                var sheetEntity = await context.InputData
                    .FirstOrDefaultAsync(s =>
                        s.MeltNumber == melt &&
                        s.BatchNumber == partNo &&
                        s.PackNumber == pack &&
                        s.SheetNumber == sheet);

                return sheetEntity?.MatId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при поиске MatId для зоны {Zone}", zoneName);
                return null;
            }
        }

        /// <summary>
        /// Получает значение из OPC UA для указанной зоны
        /// </summary>
        private string? GetValueFromZone(string zoneName, string field)
        {
            // Для E1 могут быть другие алиасы
            if (zoneName == "E1")
            {
                return _opcService.GetValue($"E1_{field}")?.Value?.ToString();
            }
            return _opcService.GetValue($"{zoneName}_{field}")?.Value?.ToString();
        }

        /// <summary>
        /// Перемещает данные листа из текущей зоны в следующую
        /// </summary>
        private void MoveSheetToNextZone(string currentZone)
        {
            var zonesInOrder = new[] { "E1", "F1", "F2", "F3", "F4", "X1", "X2" };
            var currentIndex = Array.IndexOf(zonesInOrder, currentZone);

            if (currentIndex >= 0 && currentIndex < zonesInOrder.Length - 1)
            {
                var nextZone = zonesInOrder[currentIndex + 1];
                if (_currentSheetInZone.TryGetValue(currentZone, out var matId))
                {
                    _currentSheetInZone[nextZone] = matId;
                    _currentSheetInZone.Remove(currentZone);
                    _logger.LogDebug("Лист {MatId} перемещён из {CurrentZone} в {NextZone}",
                        matId, currentZone, nextZone);
                }
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