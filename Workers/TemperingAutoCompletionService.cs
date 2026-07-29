using Dapper;
using Npgsql;
using Microsoft.Extensions.Logging;

namespace MES_ME.Server.Workers;

/// <summary>
/// Автоматически отслеживает завершение цикла отпуска в печах через PLC
/// и выгружает кассету, обновляя статусы всех её листов.
/// Работает с таблицей mes.tempering_sessions_new.
/// 
/// Условие завершения синхронизировано с TemperingSessionWorker (Sql.UpsertTemperingSessions):
///   - proc_end = TRUE
///   - ИЛИ proc_run = FALSE И time_proc_set = 0 И act_time_total = 0
/// 
/// Время loaded_at перезаписывается на реальный старт цикла из PLC,
/// а не на момент виртуальной загрузки оператором.
/// </summary>
public class TemperingAutoCompletionService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<TemperingAutoCompletionService> _logger;
    private const int POLL_INTERVAL_SEC = 30;

    public TemperingAutoCompletionService(
        IServiceProvider services,
        ILogger<TemperingAutoCompletionService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "TemperingAutoCompletionService запущен. Интервал опроса: {Interval}с",
            POLL_INTERVAL_SEC);

        // ✅ PeriodicTimer корректно работает с CancellationToken
        // и не запускает следующую итерацию, пока не завершена предыдущая
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(POLL_INTERVAL_SEC));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await CheckCompletionsAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                // ✅ Обработка штатного прерывания запроса при остановке контейнера
                catch (PostgresException ex) when (ex.SqlState == "57014" && stoppingToken.IsCancellationRequested)
                {
                    _logger.LogWarning("Запрос прерван из-за остановки сервиса (Graceful Shutdown)");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка в итерации TemperingAutoCompletionService");
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Штатное завершение
        }

        _logger.LogInformation("TemperingAutoCompletionService остановлен");
    }

    private async Task CheckCompletionsAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var dataSource = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();
        await using var con = await dataSource.OpenConnectionAsync(ct);

        // ✅ Условие завершения синхронизировано с Sql.UpsertTemperingSessions:
        //    proc_end = TRUE ИЛИ (proc_run = FALSE И time_proc_set = 0 И act_time_total = 0)
        // ✅ Также забираем ts.loaded_at — нужно для поиска реального старта цикла
        var completedFurnaces = (await con.QueryAsync<FurnaceCompletionDto>(
            new CommandDefinition(@"
                WITH latest_data AS (
                    SELECT DISTINCT ON (furnace_no)
                        furnace_no, proc_end, proc_run, time_proc_set, act_time_total, time
                    FROM plc.tempering_data
                    ORDER BY furnace_no, time DESC
                )
                SELECT 
                    ld.furnace_no      AS FurnaceNo,
                    ts.id              AS SessionId,
                    ts.business_key    AS BusinessKey,
                    ts.cassette_number AS CassetteNumber,
                    ts.loaded_at       AS LoadedAt
                FROM latest_data ld
                INNER JOIN mes.tempering_sessions_new ts
                    ON ts.furnace_number = ld.furnace_no 
                    AND ts.unloaded_at IS NULL
                WHERE ld.proc_end = TRUE 
                   OR (ld.proc_run = FALSE 
                       AND COALESCE(ld.time_proc_set, 0) = 0 
                       AND COALESCE(ld.act_time_total, 0) = 0)",
                cancellationToken: ct)
        )).ToList();

        if (completedFurnaces.Count == 0)
            return;

        _logger.LogInformation(
            "🔥 PLC зафиксировал завершение отпуска в {Count} печах",
            completedFurnaces.Count);

        int processed = 0;
        foreach (var item in completedFurnaces)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                await ProcessCompletedFurnaceAsync(con, item, ct);
                processed++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Ошибка при автозавершении печи №{Furnace}, сессия {SessionId}",
                    item.FurnaceNo, item.SessionId);
            }
        }

        if (processed > 0)
            _logger.LogInformation("✅ Автозавершение: обработано {Count} печей", processed);
    }

    private async Task ProcessCompletedFurnaceAsync(
        NpgsqlConnection con, FurnaceCompletionDto item, CancellationToken ct)
    {
        // 1. ✅ Находим РЕАЛЬНОЕ время старта цикла из PLC
        //    (когда PLC официально начал нагрев: proc_run = TRUE и задано время)
        //    Если PLC не прислал такие данные — fallback на виртуальное время оператора
        var realStartTime = await con.QueryFirstOrDefaultAsync<DateTime?>(
            new CommandDefinition(@"
                SELECT MIN(time) 
                FROM plc.tempering_data 
                WHERE furnace_no = @FurnaceNo 
                  AND time >= @VirtualLoadedAt
                  AND proc_run = TRUE 
                  AND time_proc_set > 0",
                new
                {
                    item.FurnaceNo,
                    VirtualLoadedAt = item.LoadedAt
                },
                cancellationToken: ct));

        // 2. Получаем статистику: максимальная температура и реальное время завершения
        var plcStats = await con.QueryFirstOrDefaultAsync<PlcStatsDto>(
            new CommandDefinition(@"
                SELECT 
                    MAX(temp_act) AS max_temp,
                    MAX(CASE 
                        WHEN proc_end = TRUE 
                          OR (proc_run = FALSE 
                              AND COALESCE(time_proc_set, 0) = 0 
                              AND COALESCE(act_time_total, 0) = 0) 
                        THEN time 
                    END) AS end_time
                FROM plc.tempering_data
                WHERE furnace_no = @FurnaceNo 
                  AND time >= @LoadedAt",
                new
                {
                    item.FurnaceNo,
                    LoadedAt = item.LoadedAt
                },
                cancellationToken: ct));

        if (plcStats?.end_time == null)
        {
            _logger.LogWarning(
                "Не удалось найти время завершения цикла для печи №{Furnace}",
                item.FurnaceNo);
            return;
        }

        // ✅ loaded_at = реальное время старта (если нашли), иначе виртуальное
        // ✅ unloaded_at = реальное время завершения из PLC (а не DateTime.UtcNow)
        DateTime loadedAt = realStartTime ?? item.LoadedAt;
        DateTime unloadedAt = plcStats.end_time.Value;
        double durationMin = (unloadedAt - loadedAt).TotalMinutes;
        decimal? maxTemp = plcStats.max_temp;

        // 3. Обновляем сессию — ПЕРЕЗАПИСЫВАЕМ loaded_at на реальное время старта
        var updatedBusinessKey = await con.QueryFirstOrDefaultAsync<string>(
            new CommandDefinition(@"
                UPDATE mes.tempering_sessions_new 
                SET loaded_at = @LoadedAt,
                    unloaded_at = @UnloadedAt, 
                    completed_by_plc = TRUE, 
                    unloaded_by = 'PLC_AUTO',
                    status = 'Отпуск завершён',
                    total_time_min = @DurationMin,
                    max_temp = COALESCE(@MaxTemp, max_temp)
                WHERE id = @SessionId
                  AND unloaded_at IS NULL
                RETURNING business_key",
                new
                {
                    LoadedAt = loadedAt,
                    UnloadedAt = unloadedAt,
                    SessionId = item.SessionId,
                    DurationMin = durationMin,
                    MaxTemp = maxTemp
                },
                cancellationToken: ct));

        if (string.IsNullOrEmpty(updatedBusinessKey))
        {
            _logger.LogWarning(
                "Сессия {SessionId} уже была выгружена (race condition)",
                item.SessionId);
            return;
        }

        // 4. ✅ Обновляем статусы всех листов кассеты
        //    - mes.inputdata (без подчёркивания — правильное имя таблицы)
        //    - НЕ трогаем quenching_status (это поле для закалки, не для отпуска)
        var updatedCount = await con.ExecuteAsync(
            new CommandDefinition(@"
                UPDATE mes.inputdata 
                SET status = 'Отпуск пройден'
                WHERE matid IN (
                    SELECT cs.mat_id 
                    FROM mes.cassette_sheets cs
                    WHERE cs.cassette_business_key = @BusinessKey
                ) 
                AND status IN ('В печи отпуска', 'Добавлен в кассету', 'В кассете')",
                new { BusinessKey = updatedBusinessKey },
                cancellationToken: ct));

        _logger.LogInformation(
            "📤 Печь №{Furnace}: кассета №{Cassette} (key={Key}) автовыгружена PLC. " +
            "Реальный старт: {LoadedAt}, Завершение: {UnloadedAt}, " +
            "Время: {Duration:F1} мин, Макс. t°: {Temp}. Обновлено {Count} листов.",
            item.FurnaceNo, item.CassetteNumber, updatedBusinessKey,
            loadedAt, unloadedAt, durationMin, maxTemp, updatedCount);
    }

    // -----------------------------------------------------------------------
    // DTO
    // -----------------------------------------------------------------------

    private class PlcStatsDto
    {
        public decimal? max_temp { get; set; }
        public DateTime? end_time { get; set; }
    }

    private class FurnaceCompletionDto
    {
        public int FurnaceNo { get; set; }
        public long SessionId { get; set; }
        public string BusinessKey { get; set; } = string.Empty;
        public int CassetteNumber { get; set; }
        public DateTime LoadedAt { get; set; } // ✅ виртуальное время загрузки от оператора
    }
}