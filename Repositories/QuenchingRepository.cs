using Dapper;
using MES_ME.Server.DTOs;
using MES_ME.Server.Infrastructure;
using MES_ME.Server.Models;
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

        // Новые методы для API
        Task<int> GetSessionCountAsync(DateTime? from, DateTime? to, int? slab, int? melt, int? alloyCode, CancellationToken ct);
        Task<IEnumerable<QuenchingSession>> GetSessionListAsync(DateTime? from, DateTime? to, int? slab, int? melt, int? alloyCode, int pageSize, int offset, CancellationToken ct);
        Task<QuenchingSession?> GetSessionByKeyAsync(string businessKey, CancellationToken ct);
        Task<IEnumerable<QuenchingSession>> GetSessionsBySheetAsync(int sheet, CancellationToken ct);
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


        public async Task<int> GetSessionCountAsync(DateTime? from, DateTime? to, int? slab, int? melt, int? alloyCode, CancellationToken ct)
        {
            using var db = CreateConnection();
            return await db.ExecuteScalarAsync<int>(Sql.QuenchingSessionCount, new
            {
                From = from,
                To = to,
                Slab = slab,
                Melt = melt,
                AlloyCode = alloyCode
            });
        }

        public async Task<IEnumerable<QuenchingSession>> GetSessionListAsync(DateTime? from, DateTime? to, int? slab, int? melt, int? alloyCode, int pageSize, int offset, CancellationToken ct)
        {
            using var db = CreateConnection();
            return await db.QueryAsync<QuenchingSession>(Sql.QuenchingSessionList, new
            {
                From = from,
                To = to,
                Slab = slab,
                Melt = melt,
                AlloyCode = alloyCode,
                PageSize = pageSize,
                Offset = offset
            });
        }

        public async Task<QuenchingSession?> GetSessionByKeyAsync(string businessKey, CancellationToken ct)
        {
            using var db = CreateConnection();
            return await db.QuerySingleOrDefaultAsync<QuenchingSession>(Sql.QuenchingSessionByKey, new { Key = businessKey });
        }

        public async Task<IEnumerable<QuenchingSession>> GetSessionsBySheetAsync(int sheet, CancellationToken ct)
        {
            using var db = CreateConnection();
            return await db.QueryAsync<QuenchingSession>(Sql.QuenchingSessionsBySheet, new { Sheet = sheet });
        }
    }

}
