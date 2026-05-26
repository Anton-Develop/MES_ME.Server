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
            var command = new CommandDefinition(
                Sql.FindCompletedQuenchingSheets,
                new { GracePeriodMinutes = gracePeriodMinutes },
                commandTimeout: 300,
                cancellationToken: ct
            );
            return await db.QueryAsync(command);
        }

        public async Task<IEnumerable<dynamic>> FindMissedQuenchingSheetsAsync(int catchUpDays, int gracePeriodMinutes, CancellationToken ct)
        {
            using var db = CreateConnection();
            var command = new CommandDefinition(
                Sql.FindMissedQuenchingSheets,
                new { DaysBack = catchUpDays, GracePeriodMinutes = gracePeriodMinutes },
                commandTimeout: 300,
                cancellationToken: ct
            );
            return await db.QueryAsync(command);
        }

        public async Task<QuenchingDataDto> GetQuenchingArraysAsync(DateTime from, DateTime to, CancellationToken ct)
        {
            using var db = CreateConnection();
            var command = new CommandDefinition(
                Sql.GetQuenchingArrays,
                new { From = from, To = to },
                commandTimeout: 300,
                cancellationToken: ct
            );
            return await db.QuerySingleAsync<QuenchingDataDto>(command);
        }

        public async Task UpsertQuenchingSessionAsync(object parameters, CancellationToken ct)
        {
            using var db = CreateConnection();
            var command = new CommandDefinition(
                Sql.UpsertQuenchingSession,
                parameters,
                commandTimeout: 300,
                cancellationToken: ct
            );
            await db.ExecuteAsync(command);
        }

        // Остальные методы без изменений...
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