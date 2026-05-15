using Dapper;
using MES_ME.Server.DTOs;
using MES_ME.Server.Infrastructure;
using MES_ME.Server.Models;
using Npgsql;
using NpgsqlTypes;
using Polly;
using Polly.Retry;
using System.Data;
using System.Text.Json;
using static MES_ME.Server.DTOs.TemperingSessionDTO;


namespace MES_ME.Server.Repositories;

public interface IFurnaceRepository
{
    Task<IEnumerable<ZoneHistoryDto>> GetZoneHistoryAsync(ZoneHistoryFilter filter, CancellationToken ct = default);
    Task<IEnumerable<ZoneHistoryDto>> GetZoneTrackBySheetAsync(int sheet, CancellationToken ct = default);
    Task<IEnumerable<TemperatureBucketDto>> GetTemperatureHistoryAsync(TemperatureFilter filter, CancellationToken ct = default);
    Task<IEnumerable<FurnaceTemperature>> GetTemperatureRangeAsync(DateTime from, DateTime to, CancellationToken ct = default);
    Task<HeatingSession?> GetSessionBySheetAsync(int sheet, CancellationToken ct = default);
    Task<PagedResult<HeatingSession>> GetSessionsAsync(SessionFilter filter, CancellationToken ct = default);

    // Worker methods
    Task<IEnumerable<dynamic>> FindCompletedSheetsAsync(int gracePeriodMinutes, CancellationToken ct = default);
    Task<IEnumerable<dynamic>> FindMissedSheetsAsync(int daysBack, CancellationToken ct = default);
    Task<TemperatureArraysDto> GetTemperatureArraysAsync(DateTime from, DateTime to, CancellationToken ct = default);

    Task<HeatingSession?> GetSessionByKeyAsync(string key, CancellationToken ct = default);

    Task UpsertHeatingSessionAsync(object parameters, CancellationToken ct = default);


    //For RelFirn
    Task<TemperingSessionDto?> GetTemperingSessionByIdAsync(long id, CancellationToken ct = default);
    Task<PagedResult<TemperingSessionDto>> GetTemperingSessionsAsync(TemperingSessionFilter filter, CancellationToken ct = default);
    Task<IEnumerable<TemperingDetailDto>> GetTemperingSessionDetailsAsync(int furnaceNo, DateTime startedAt, DateTime endedAt, CancellationToken ct = default);
}

public sealed class FurnaceRepository : IFurnaceRepository
{
    private readonly NpgsqlDataSource _ds;
    private readonly ILogger<FurnaceRepository> _log;
    private readonly AsyncRetryPolicy _retry;

    public FurnaceRepository(NpgsqlDataSource ds, ILogger<FurnaceRepository> log)
    {
        _ds = ds;
        _log = log;
        _retry = Policy
            .Handle<NpgsqlException>(ex => ex.IsTransient)
            .Or<TimeoutException>()
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
                onRetry: (ex, delay, attempt, _) =>
                    _log.LogWarning(ex, "DB retry {Attempt}/3 after {Delay:N1}s", attempt, delay.TotalSeconds));
    }

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken ct)
        => await _ds.OpenConnectionAsync(ct);

    public async Task<IEnumerable<ZoneHistoryDto>> GetZoneHistoryAsync(ZoneHistoryFilter filter, CancellationToken ct = default)
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
    public async Task<HeatingSession?> GetSessionByKeyAsync(string key, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QuerySingleOrDefaultAsync<HeatingSession>(
                Sql.SessionByKey, new { Key = key });
        });
    }

    public async Task<IEnumerable<ZoneHistoryDto>> GetZoneTrackBySheetAsync(int sheet, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QueryAsync<ZoneHistoryDto>(Sql.ZoneTrackBySheet, new { Sheet = sheet });
        });
    }

    public async Task<IEnumerable<TemperatureBucketDto>> GetTemperatureHistoryAsync(TemperatureFilter filter, CancellationToken ct = default)
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

    public async Task<IEnumerable<FurnaceTemperature>> GetTemperatureRangeAsync(DateTime from, DateTime to, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QueryAsync<FurnaceTemperature>(Sql.TemperatureByRange, new { From = from, To = to });
        });
    }

    public async Task<HeatingSession?> GetSessionBySheetAsync(int sheet, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QuerySingleOrDefaultAsync<HeatingSession>(Sql.SessionBySheet, new { Sheet = sheet });
        });
    }

    public async Task<PagedResult<HeatingSession>> GetSessionsAsync(SessionFilter filter, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);

            var p = new DynamicParameters();
            p.Add("@From", filter.From, DbType.DateTime);
            p.Add("@To", filter.To, DbType.DateTime);
            p.Add("@Slab", filter.Slab, DbType.Int32);
            p.Add("@Melt", filter.Melt, DbType.Int32);
            p.Add("@AlloyCode", filter.AlloyCode, DbType.Int32);
            p.Add("@PageSize", filter.PageSize, DbType.Int32);
            p.Add("@Offset", (filter.Page - 1) * filter.PageSize, DbType.Int32);

            var totalCmd = new CommandDefinition(Sql.SessionCount, p, commandTimeout: 60, cancellationToken: ct);
            var total = await con.ExecuteScalarAsync<int>(totalCmd);

            var listCmd = new CommandDefinition(Sql.SessionList, p, commandTimeout: 60, cancellationToken: ct);
            var items = await con.QueryAsync<HeatingSession>(listCmd);

            return new PagedResult<HeatingSession>
            {
                Items = items,
                Total = total,
                Page = filter.Page,
                PageSize = filter.PageSize
            };
        });
    }

    public async Task<IEnumerable<dynamic>> FindCompletedSheetsAsync(int gracePeriodMinutes, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QueryAsync(Sql.FindCompletedSheets, new { GracePeriodMinutes = gracePeriodMinutes });
        });
    }

    public async Task<IEnumerable<dynamic>> FindMissedSheetsAsync(int daysBack, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            return await con.QueryAsync(Sql.FindMissedSheets, new { DaysBack = daysBack });
        });
    }



    public async Task<TemperatureArraysDto> GetTemperatureArraysAsync(
    DateTime from, DateTime to, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);

            // Явно UTC — иначе Npgsql отклонит для timestamptz
            var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Utc);
            var toUtc = DateTime.SpecifyKind(to, DateTimeKind.Utc);

            using var cmd = new NpgsqlCommand(Sql.GetTemperaturesArray, con);
            cmd.Parameters.AddWithValue("@From", NpgsqlTypes.NpgsqlDbType.TimestampTz, fromUtc);
            cmd.Parameters.AddWithValue("@To", NpgsqlTypes.NpgsqlDbType.TimestampTz, toUtc);


            await using var reader = await cmd.ExecuteReaderAsync(ct);
            var result = new TemperatureArraysDto();

            if (!await reader.ReadAsync(ct)) return result; // нет строк вообще

            // Безопасное чтение jsonb — null если колонка DBNull
            static List<float?> ReadFloats(NpgsqlDataReader r, int col)
            {
                if (r.IsDBNull(col)) return [];
                var json = r.GetString(col);   // GetString безопаснее GetValue для jsonb
                return JsonSerializer.Deserialize<List<float?>>(json) ?? [];
            }

            static List<DateTime> ReadTimes(NpgsqlDataReader r, int col)
            {
                if (r.IsDBNull(col)) return [];
                var json = r.GetString(col);
                // PostgreSQL отдаёт timestamptz в ISO формате
                return JsonSerializer.Deserialize<List<DateTime>>(json)
                    ?.Select(d => DateTime.SpecifyKind(d, DateTimeKind.Utc))
                    .ToList() ?? [];
            }

            result.Z1_1 = ReadFloats(reader, 0);
            result.Z1_2 = ReadFloats(reader, 1);
            result.Z1_3 = ReadFloats(reader, 2);
            result.Z1_4 = ReadFloats(reader, 3);
            result.Z2_1 = ReadFloats(reader, 4);
            result.Z2_2 = ReadFloats(reader, 5);
            result.Z2_3 = ReadFloats(reader, 6);
            result.Z2_4 = ReadFloats(reader, 7);
            result.Z3_1 = ReadFloats(reader, 8);
            result.Z3_2 = ReadFloats(reader, 9);
            result.Z3_3 = ReadFloats(reader, 10);
            result.Z3_4 = ReadFloats(reader, 11);
            result.Z4_1 = ReadFloats(reader, 12);
            result.Z4_2 = ReadFloats(reader, 13);
            result.Z4_3 = ReadFloats(reader, 14);
            result.Z4_4 = ReadFloats(reader, 15);
            result.Times    = ReadTimes(reader, 16);
            // Задания
            result.Z1_1_Ref = ReadFloats(reader, 17);
            result.Z2_1_Ref = ReadFloats(reader, 18);
            result.Z3_1_Ref = ReadFloats(reader, 19);
            result.Z4_1_Ref = ReadFloats(reader, 20);


            return result;
        });
    }



    public async Task UpsertHeatingSessionAsync(object parameters, CancellationToken ct = default)
    {
        await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);

            // JSONB INSERT может быть тяжёлым — даём 120 секунд
            var cmd = new CommandDefinition(
                Sql.UpsertHeatingSession,
                parameters,
                commandTimeout: 120,
                cancellationToken: ct);

            await con.ExecuteAsync(cmd);
        });

    }

    //For RelFurn - отпускные печки для worker TemperingSessionWorker
    public async Task<TemperingSessionDto?> GetTemperingSessionByIdAsync(long id, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            const string sql = @"
                SELECT 
                    id, furnace_no AS FurnaceNo, started_at AS StartedAt, ended_at AS EndedAt,
                    duration_min AS DurationMin,
                    temp_min AS TempMin, temp_max AS TempMax, temp_avg AS TempAvg,
                    temp_ref AS TempRef, target_temp AS TargetTemp, target_time AS TargetTime,
                    point_ref_1 AS PointRef1, point_time_1 AS PointTime1, point_dtime_2 AS PointDtime2,
                    cassette_no AS CassetteNo, cass_day AS CassDay, cass_month AS CassMonth,
                    cass_year AS CassYear, cass_hour AS CassHour,
                    cass1_no AS Cass1No, cass1_day AS Cass1Day, cass1_month AS Cass1Month,
                    cass1_year AS Cass1Year, cass1_hour AS Cass1Hour,
                    cass2_no AS Cass2No, cass2_day AS Cass2Day, cass2_month AS Cass2Month,
                    cass2_year AS Cass2Year, cass2_hour AS Cass2Hour,
                    had_fault AS HadFault
                FROM plc.tempering_sessions
                WHERE id = @Id";
            return await con.QuerySingleOrDefaultAsync<TemperingSessionDto>(sql, new { Id = id });
        });
    }

    public async Task<PagedResult<TemperingSessionDto>> GetTemperingSessionsAsync(TemperingSessionFilter filter, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);

            var where = "WHERE 1=1";
            if (filter.FurnaceNo.HasValue)
                where += " AND furnace_no = @FurnaceNo";
            if (filter.From.HasValue)
                where += " AND started_at >= @From";
            if (filter.To.HasValue)
                where += " AND started_at <= @To";

            var countSql = $"SELECT COUNT(*) FROM plc.tempering_sessions {where}";
            var total = await con.ExecuteScalarAsync<int>(countSql, filter);

            var listSql = $@"
                SELECT 
                    id, furnace_no AS FurnaceNo, started_at AS StartedAt, ended_at AS EndedAt,
                    duration_min AS DurationMin,
                    temp_min AS TempMin, temp_max AS TempMax, temp_avg AS TempAvg,
                    temp_ref AS TempRef, target_temp AS TargetTemp, target_time AS TargetTime,
                    point_ref_1 AS PointRef1, point_time_1 AS PointTime1, point_dtime_2 AS PointDtime2,
                    cassette_no AS CassetteNo, cass_day AS CassDay, cass_month AS CassMonth,
                    cass_year AS CassYear, cass_hour AS CassHour,
                    cass1_no AS Cass1No, cass1_day AS Cass1Day, cass1_month AS Cass1Month,
                    cass1_year AS Cass1Year, cass1_hour AS Cass1Hour,
                    cass2_no AS Cass2No, cass2_day AS Cass2Day, cass2_month AS Cass2Month,
                    cass2_year AS Cass2Year, cass2_hour AS Cass2Hour,
                    had_fault AS HadFault
                FROM plc.tempering_sessions
                {where}
                ORDER BY started_at DESC
                LIMIT @PageSize OFFSET @Offset";

            var items = await con.QueryAsync<TemperingSessionDto>(listSql, new
            {
                filter.FurnaceNo,
                filter.From,
                filter.To,
                filter.PageSize,
                Offset = (filter.Page - 1) * filter.PageSize
            });

            return new PagedResult<TemperingSessionDto>
            {
                Items = items,
                Total = total,
                Page = filter.Page,
                PageSize = filter.PageSize
            };
        });
    }

    public async Task<IEnumerable<TemperingDetailDto>> GetTemperingSessionDetailsAsync(int furnaceNo, DateTime startedAt, DateTime endedAt, CancellationToken ct = default)
    {
        return await _retry.ExecuteAsync(async () =>
        {
            await using var con = await OpenAsync(ct);
            const string sql = @"
                SELECT 
                    time, 
                    temp_act AS TempAct, 
                    temp_ref AS TempRef, 
                    t1, t2, 
                    t_average_furn AS TAverageFurn,
                    act_time_total AS ActTimeTotal, 
                    time_to_proc_end AS TimeToProcEnd
                FROM plc.tempering_data
                WHERE furnace_no = @FurnaceNo
                AND time BETWEEN @StartedAt AND @EndedAt
                ORDER BY time ASC";
            return await con.QueryAsync<TemperingDetailDto>(sql, new { FurnaceNo = furnaceNo, StartedAt = startedAt, EndedAt = endedAt });
        });
    }
}