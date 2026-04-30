using Dapper;
using MES_ME.Server.DTOs;
using MES_ME.Server.Infrastructure;
using MES_ME.Server.Models;
using Npgsql;
using Polly;
using Polly.Retry;

namespace MES_ME.Server.Repositories;

public interface IFurnaceRepository
{
    Task<IEnumerable<ZoneHistoryDto>>       GetZoneHistoryAsync(ZoneHistoryFilter filter, CancellationToken ct = default);
    Task<IEnumerable<ZoneHistoryDto>>       GetZoneTrackBySheetAsync(int sheet, CancellationToken ct = default);
    Task<IEnumerable<TemperatureBucketDto>> GetTemperatureHistoryAsync(TemperatureFilter filter, CancellationToken ct = default);
    Task<IEnumerable<FurnaceTemperature>>   GetTemperatureRangeAsync(DateTime from, DateTime to, CancellationToken ct = default);
    Task<HeatingSession?>                   GetSessionBySheetAsync(int sheet, CancellationToken ct = default);
    Task<PagedResult<HeatingSession>>       GetSessionsAsync(SessionFilter filter, CancellationToken ct = default);
    // Используется только Worker'ом
    Task<IEnumerable<dynamic>>              FindCompletedSheetsAsync(int gracePeriodMinutes, CancellationToken ct = default);
    Task<dynamic?>                          GetAvgTempsAsync(DateTime from, DateTime to, CancellationToken ct = default);
    Task                                    UpsertHeatingSessionAsync(object parameters, CancellationToken ct = default);
}

public sealed class FurnaceRepository : IFurnaceRepository
{
    private readonly NpgsqlDataSource   _ds;
    private readonly ILogger<FurnaceRepository> _log;
    private readonly AsyncRetryPolicy   _retry;

    public FurnaceRepository(NpgsqlDataSource ds, ILogger<FurnaceRepository> log)
    {
        _ds  = ds;
        _log = log;

        // Retry: 3 попытки с экспоненциальной задержкой
        // Только на transient-ошибки PostgreSQL (connection, timeout)
        _retry = Policy
            .Handle<NpgsqlException>(ex => ex.IsTransient)
            .Or<TimeoutException>()
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
                onRetry: (ex, delay, attempt, _) =>
                    _log.LogWarning(ex,
                        "DB retry {Attempt}/3 after {Delay:N1}s: {Message}",
                        attempt, delay.TotalSeconds, ex.Message));
    }

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken ct)
        => await _ds.OpenConnectionAsync(ct);

    // -----------------------------------------------------------------------
    public async Task<IEnumerable<ZoneHistoryDto>> GetZoneHistoryAsync(
        ZoneHistoryFilter filter, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QueryAsync<ZoneHistoryDto>(Sql.ZoneHistory, new
            {
                filter.From,
                filter.To,
                filter.Zone,
                filter.Sheet,
                filter.Limit
            });
        });
    }

    // -----------------------------------------------------------------------
    public async Task<IEnumerable<ZoneHistoryDto>> GetZoneTrackBySheetAsync(
        int sheet, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QueryAsync<ZoneHistoryDto>(Sql.ZoneTrackBySheet, new { Sheet = sheet });
        });
    }

    // -----------------------------------------------------------------------
    public async Task<IEnumerable<TemperatureBucketDto>> GetTemperatureHistoryAsync(
        TemperatureFilter filter, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QueryAsync<TemperatureBucketDto>(Sql.TemperatureHistory, new
            {
                filter.From,
                filter.To,
                filter.IntervalMinutes
            });
        });
    }

    // -----------------------------------------------------------------------
    public async Task<IEnumerable<FurnaceTemperature>> GetTemperatureRangeAsync(
        DateTime from, DateTime to, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QueryAsync<FurnaceTemperature>(
                Sql.TemperatureByRange, new { From = from, To = to });
        });
    }

    // -----------------------------------------------------------------------
    public async Task<HeatingSession?> GetSessionBySheetAsync(
        int sheet, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QuerySingleOrDefaultAsync<HeatingSession>(
                Sql.SessionBySheet, new { Sheet = sheet });
        });
    }

    // -----------------------------------------------------------------------
    public async Task<PagedResult<HeatingSession>> GetSessionsAsync(
        SessionFilter filter, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);

            var p = new
            {
                filter.From,
                filter.To,
                filter.Slab,
                filter.Melt,
                filter.AlloyCode,
                PageSize = filter.PageSize,
                Offset   = (filter.Page - 1) * filter.PageSize
            };

            var total = await con.ExecuteScalarAsync<int>(Sql.SessionCount, p);
            var items = await con.QueryAsync<HeatingSession>(Sql.SessionList, p);

            return new PagedResult<HeatingSession>
            {
                Items    = items,
                Total    = total,
                Page     = filter.Page,
                PageSize = filter.PageSize
            };
        });
    }

    // -----------------------------------------------------------------------
    // Worker methods
    // -----------------------------------------------------------------------
    public async Task<IEnumerable<dynamic>> FindCompletedSheetsAsync(
        int gracePeriodMinutes, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QueryAsync(Sql.FindCompletedSheets,
                new { GracePeriodMinutes = gracePeriodMinutes });
        });
    }

    public async Task<dynamic?> GetAvgTempsAsync(
        DateTime from, DateTime to, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QuerySingleOrDefaultAsync(
                Sql.AvgTempsForSession, new { From = from, To = to });
        });
    }

    public async Task UpsertHeatingSessionAsync(object parameters, CancellationToken ct = default)
    {
        await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            await con.ExecuteAsync(Sql.UpsertHeatingSession, parameters);
        });
    }
}
