using Dapper;
using MES_ME.Server.Infrastructure;
using Npgsql;

namespace MES_ME.Server.Repositories;

public interface ITemperingRepository
{
    Task<int> UpsertSessionsAsync(int lookbackDays, int gracePeriodMinutes, CancellationToken ct);
    Task<PagedResult<TemperingSessionDto>> GetSessionsAsync(int? furnaceNo, DateTime? from, DateTime? to, int page, int pageSize, CancellationToken ct);
    Task<TemperingSessionDetailsDto?> GetSessionDetailsAsync(long id, CancellationToken ct);
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

    public async Task<PagedResult<TemperingSessionDto>> GetSessionsAsync(int? furnaceNo, DateTime? from, DateTime? to, int page, int pageSize, CancellationToken ct)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(ct);

        var offset = (page - 1) * pageSize;
        var parameters = new { FurnaceNo = furnaceNo, From = from, To = to, PageSize = pageSize, Offset = offset };

        var items = (await connection.QueryAsync<TemperingSessionDto>(
            new CommandDefinition(Sql.GetTemperingSessions, parameters, cancellationToken: ct))).ToList();

        var total = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition(Sql.GetTemperingSessionsCount, parameters, cancellationToken: ct));

        return new PagedResult<TemperingSessionDto>(items, total, page, pageSize);
    }

    public async Task<TemperingSessionDetailsDto?> GetSessionDetailsAsync(long id, CancellationToken ct)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(ct);

        // Получаем сессию
        var session = await connection.QueryFirstOrDefaultAsync<TemperingSessionDto>(
            new CommandDefinition(@"
                SELECT * FROM plc.tempering_sessions WHERE id = @Id",
                new { Id = id },
                cancellationToken: ct));

        if (session == null)
            return null;

        // Получаем временной ряд температур
        var details = await connection.QueryAsync<TemperingDataPoint>(
            new CommandDefinition(Sql.GetTemperingSessionDetails,
                new { FurnaceNo = session.FurnaceNo, StartedAt = session.StartedAt, EndedAt = session.EndedAt },
                cancellationToken: ct));

        return new TemperingSessionDetailsDto
        {
            Session = session,
            Details = details.ToList()
        };
    }
}

// DTO классы
public record TemperingSessionDto
{
    public long Id { get; init; }
    public int FurnaceNo { get; init; }
    public DateTime StartedAt { get; init; }
    public DateTime? EndedAt { get; init; }
    public double? DurationMin { get; init; }
    public double? TempMin { get; init; }
    public double? TempMax { get; init; }
    public double? TempAvg { get; init; }
    public double? TempRef { get; init; }
    public double? TargetTemp { get; init; }
    public double? TargetTime { get; init; }
    public double? PointRef1 { get; init; }
    public double? PointTime1 { get; init; }
    public double? PointDtime2 { get; init; }
    public bool? HadFault { get; init; }
    public int? CassetteNo { get; init; }
    public int? CassDay { get; init; }
    public int? CassMonth { get; init; }
    public int? CassYear { get; init; }
    public int? CassHour { get; init; }
    public int? Cass1No { get; init; }
    public int? Cass1Day { get; init; }
    public int? Cass1Month { get; init; }
    public int? Cass1Year { get; init; }
    public int? Cass1Hour { get; init; }
    public int? Cass2No { get; init; }
    public int? Cass2Day { get; init; }
    public int? Cass2Month { get; init; }
    public int? Cass2Year { get; init; }
    public int? Cass2Hour { get; init; }
}

public record TemperingDataPoint
{
    public DateTime Time { get; init; }
    public double? TempAct { get; init; }
    public double? TempRef { get; init; }
    public double? T1 { get; init; }
    public double? T2 { get; init; }
    public double? ActTimeTotal { get; init; }
    public double? TimeProcSet { get; init; }
}

public record TemperingSessionDetailsDto
{
    public TemperingSessionDto Session { get; init; } = null!;
    public List<TemperingDataPoint> Details { get; init; } = new();
}

public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);