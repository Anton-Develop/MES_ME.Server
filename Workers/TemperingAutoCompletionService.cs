using Dapper;
using MES_ME.Server.Infrastructure;
using Npgsql;

namespace MES_ME.Server.Workers;

public class TemperingAutoCompletionService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<TemperingAutoCompletionService> _logger;

    public TemperingAutoCompletionService(
        IServiceProvider services,
        ILogger<TemperingAutoCompletionService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("TemperingAutoCompletionService started");

        // ✅ Используем PeriodicTimer вместо Timer
        // Он автоматически ждёт завершения предыдущей итерации
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await CheckCompletionsAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            // ✅ Перехватываем штатное прерывание запроса при остановке контейнера
            catch (PostgresException ex) when (ex.SqlState == "57014" && stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning("Запрос прерван из-за остановки сервиса (Graceful Shutdown)");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TemperingAutoCompletionService iteration failed");
            }
        }

        _logger.LogInformation("TemperingAutoCompletionService stopped");
    }

    // ✅ Вынесли логику в отдельный async Task метод (без async void)
    private async Task CheckCompletionsAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var dataSource = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();

        await using var con = await dataSource.OpenConnectionAsync(ct);

        _logger.LogDebug("Checking for completed furnaces...");

        // Находим все печи с завершённым процессом и активными сессиями
        var completedFurnaces = await con.QueryAsync<CompletedFurnaceDto>(
            new CommandDefinition(
                Sql.FindCompletedTemperingFurnaces,
                cancellationToken: ct));

        if (completedFurnaces.Count() == 0)
        {
            _logger.LogDebug("No completed furnaces found");
            return;
        }

        _logger.LogInformation("Found {Count} completed furnaces", completedFurnaces.Count());

        int processedCount = 0;

        foreach (var furnace in completedFurnaces)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                await ProcessCompletedFurnaceAsync(con, furnace, ct);
                processedCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при обработке печи {FurnaceNo}, сессия {SessionId}",
                    furnace.FurnaceNo, furnace.SessionId);
            }
        }

        _logger.LogInformation("Processed {Count} completed furnaces", processedCount);
    }

    private async Task ProcessCompletedFurnaceAsync(NpgsqlConnection con, CompletedFurnaceDto furnace, CancellationToken ct)
    {
        // Обновляем сессию
        var cassetteId = await con.QueryFirstOrDefaultAsync<string>(
            new CommandDefinition(
                Sql.UpdateTemperingSessionAsCompleted,
                new
                {
                    UnloadedAt = DateTime.UtcNow,
                    SessionId = furnace.SessionId
                },
                cancellationToken: ct));

        if (string.IsNullOrEmpty(cassetteId))
        {
            _logger.LogWarning("Не удалось обновить сессию {SessionId}", furnace.SessionId);
            return;
        }

        _logger.LogInformation(
            "Печь {FurnaceNo}: сессия {SessionId} завершена, кассета {CassetteId}",
            furnace.FurnaceNo, furnace.SessionId, cassetteId);

        // Обновляем статус кассеты
        await con.ExecuteAsync(
            new CommandDefinition(
                Sql.UpdateCassetteStatusToTemperingCompleted,
                new { CassetteId = cassetteId },
                cancellationToken: ct));

        // Обновляем статусы листов
        await con.ExecuteAsync(
            new CommandDefinition(
                Sql.UpdateSheetsStatusToTemperingCompleted,
                new { CassetteId = cassetteId },
                cancellationToken: ct));

        _logger.LogInformation("Кассета {CassetteId} и связанные листы обновлены", cassetteId);
    }
}

// ✅ Типизированный DTO вместо dynamic
public class CompletedFurnaceDto
{
    public int FurnaceNo { get; set; }
    public bool ProcEnd { get; set; }
    public long SessionId { get; set; }
    public string? CassetteId { get; set; }
}