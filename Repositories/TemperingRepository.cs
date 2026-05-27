using Dapper;
using MES_ME.Server.Infrastructure;
using Npgsql;

namespace MES_ME.Server.Repositories;

public interface ITemperingRepository
{
    /// <summary>
    /// Находит завершённые сессии отпуска за указанный период и вставляет их в plc.tempering_sessions.
    /// Возвращает количество добавленных строк.
    /// </summary>
    Task<int> UpsertSessionsAsync(int lookbackDays, int gracePeriodMinutes, CancellationToken ct);
}
public class TemperingRepository : ITemperingRepository
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly ILogger<TemperingRepository> _log;

    public TemperingRepository(NpgsqlDataSource dataSource, ILogger<TemperingRepository> log)
    {
        _dataSource = dataSource;
        _log = log;
    }

    public async Task<int> UpsertSessionsAsync(int lookbackDays, int gracePeriodMinutes, CancellationToken ct)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(ct);

        var command = new CommandDefinition(
            Sql.UpsertTemperingSessions,
            new { LookbackDays = lookbackDays, GracePeriodMinutes = gracePeriodMinutes },
            commandTimeout: 300,
            cancellationToken: ct);

        return await connection.ExecuteAsync(command);
    }
}