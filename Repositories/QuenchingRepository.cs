using Dapper;
using MES_ME.Server.DTOs;
using MES_ME.Server.Infrastructure;
using Npgsql;
using System.Data;


namespace MES_ME.Server.Repositories
{
    public interface IQuenchingRepository
    {
        Task<IEnumerable<dynamic>> FindCompletedQuenchingSheetsAsync(int gracePeriodMinutes, CancellationToken ct);
        Task<IEnumerable<dynamic>> FindMissedQuenchingSheetsAsync(int catchUpDays, int gracePeriodMinutes, CancellationToken ct);
        Task<QuenchingDataDto> GetQuenchingArraysAsync(DateTime from, DateTime to, CancellationToken ct);
        Task UpsertQuenchingSessionAsync(object parameters, CancellationToken ct);
    }


    public class QuenchingRepository : IQuenchingRepository
    {
        private readonly string _connStr;

        public QuenchingRepository(IConfiguration cfg)
        {
            _connStr = cfg.GetConnectionString("DefaultConnection")!;
        }

        private IDbConnection CreateConnection() => new NpgsqlConnection(_connStr);

        public async Task<IEnumerable<dynamic>> FindCompletedQuenchingSheetsAsync(int gracePeriodMinutes, CancellationToken ct)
        {
            using var db = CreateConnection();
            return await db.QueryAsync(Sql.FindCompletedQuenchingSheets, new { GracePeriodMinutes = gracePeriodMinutes });
        }

        public async Task<IEnumerable<dynamic>> FindMissedQuenchingSheetsAsync(int catchUpDays, int gracePeriodMinutes, CancellationToken ct)
        {
            using var db = CreateConnection();
            return await db.QueryAsync(Sql.FindMissedQuenchingSheets,
                new { DaysBack = catchUpDays, GracePeriodMinutes = gracePeriodMinutes });
        }

        public async Task<QuenchingDataDto> GetQuenchingArraysAsync(DateTime from, DateTime to, CancellationToken ct)
        {
            using var db = CreateConnection();
            var result = await db.QuerySingleAsync<QuenchingDataDto>(Sql.GetQuenchingArrays, new { From = from, To = to });
            return result;
        }

        public async Task UpsertQuenchingSessionAsync(object parameters, CancellationToken ct)
        {
            using var db = CreateConnection();
            await db.ExecuteAsync(Sql.UpsertQuenchingSession, parameters);
        }
    }

}
