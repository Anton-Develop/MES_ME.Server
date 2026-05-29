using Dapper;
using Npgsql;

namespace MES_ME.Server.Workers;

/// <summary>
/// Автоматически отслеживает завершение цикла отпуска в печах через PLC (proc_end = TRUE)
/// и выгружает кассету, обновляя статусы всех её листов.
/// Работает с новой изолированной таблицей mes.tempering_sessions_new.
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

        // ✅ Используем PeriodicTimer вместо Timer — корректно работает с CancellationToken
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

        // Находим все печи, где PLC выставил proc_end = TRUE и есть активная сессия
        var completedFurnaces = (await con.QueryAsync<FurnaceCompletionDto>(
            new CommandDefinition(@"
                WITH latest_data AS (
                    SELECT DISTINCT ON (furnace_no)
                        furnace_no, proc_end, time
                    FROM plc.tempering_data
                    ORDER BY furnace_no, time DESC
                )
                SELECT 
                    ld.furnace_no   AS FurnaceNo,
                    ld.proc_end     AS ProcEnd,
                    ts.id           AS SessionId,
                    ts.business_key AS BusinessKey,
                    ts.cassette_number AS CassetteNumber
                FROM latest_data ld
                INNER JOIN mes.tempering_sessions_new ts
                    ON ts.furnace_number = ld.furnace_no 
                    AND ts.unloaded_at IS NULL
                WHERE ld.proc_end = TRUE",
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
        // 1. Обновляем сессию — помечаем как выгруженную PLC'ом
        var updatedBusinessKey = await con.QueryFirstOrDefaultAsync<string>(
            new CommandDefinition(@"
                UPDATE mes.tempering_sessions_new 
                SET unloaded_at = @UnloadedAt, 
                    completed_by_plc = TRUE, 
                    unloaded_by = 'PLC_AUTO',
                    status = 'Отпуск завершён'
                WHERE id = @SessionId
                  AND unloaded_at IS NULL
                RETURNING business_key",
                new
                {
                    UnloadedAt = DateTime.UtcNow,
                    SessionId = item.SessionId
                },
                cancellationToken: ct));

        if (string.IsNullOrEmpty(updatedBusinessKey))
        {
            _logger.LogWarning(
                "Сессия {SessionId} уже была выгружена (race condition)",
                item.SessionId);
            return;
        }

        // 2. Обновляем статусы всех листов кассеты через mes.cassette_sheets
        var updatedCount = await con.ExecuteAsync(
            new CommandDefinition(@"
                UPDATE mes.input_data 
                SET status = 'Отпуск пройден',
                    quenching_status = 'Отпуск пройден'
                WHERE mat_id IN (
                    SELECT cs.mat_id 
                    FROM mes.cassette_sheets cs
                    WHERE cs.cassette_business_key = @BusinessKey
                ) 
                AND status IN ('В печи отпуска', 'Добавлен в кассету', 'В кассете')",
                new { BusinessKey = updatedBusinessKey },
                cancellationToken: ct));

        _logger.LogInformation(
            "📤 Печь №{Furnace}: кассета №{Cassette} (key={Key}) автовыгружена PLC. " +
            "Обновлено {Count} листов → 'Отпуск пройден'",
            item.FurnaceNo, item.CassetteNumber, updatedBusinessKey, updatedCount);
    }

    // DTO для результата запроса
    private class FurnaceCompletionDto
    {
        public int FurnaceNo { get; set; }
        public bool ProcEnd { get; set; }
        public long SessionId { get; set; }
        public string BusinessKey { get; set; } = string.Empty;
        public int CassetteNumber { get; set; }
    }
}