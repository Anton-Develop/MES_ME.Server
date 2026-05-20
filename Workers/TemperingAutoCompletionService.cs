using Dapper;
using MES_ME.Server.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MES_ME.Server.Workers
{
    public class TemperingAutoCompletionService : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<TemperingAutoCompletionService> _logger;
        private Timer _timer;

        public TemperingAutoCompletionService(
            IServiceProvider services,
            ILogger<TemperingAutoCompletionService> logger)
        {
            _services = services;
            _logger = logger;
        }

        protected override Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _timer = new Timer(CheckCompletions, null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));
            return Task.CompletedTask;
        }

        private async void CheckCompletions(object state)
        {
            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var dataSource = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();

            try
            {
                // Получаем текущее состояние печей напрямую из PostgreSQL через Dapper
                await using var con = await dataSource.OpenConnectionAsync();

                // Находим все печи с завершённым процессом и активными сессиями
                var completedFurnaces = await con.QueryAsync<dynamic>(@"
                    WITH latest_data AS (
                        SELECT DISTINCT ON (furnace_no)
                            furnace_no, proc_end, time
                        FROM plc.tempering_data
                        ORDER BY furnace_no, time DESC
                    )
                    SELECT 
                        ld.furnace_no,
                        ld.proc_end,
                        fcs.id AS session_id,
                        fcs.cassette_id
                    FROM latest_data ld
                    INNER JOIN mes.furnace_cassette_sessions fcs 
                        ON fcs.furnace_number = ld.furnace_no 
                        AND fcs.unloaded_at IS NULL
                    WHERE ld.proc_end = TRUE
                ");

                foreach (var item in completedFurnaces)
                {
                    // Обновляем сессию через Dapper
                    var updateSessionSql = @"
                        UPDATE mes.furnace_cassette_sessions 
                        SET unloaded_at = @UnloadedAt, 
                            completed_by_plc = TRUE, 
                            unloaded_by = 'PLC_AUTO'
                        WHERE id = @SessionId
                        RETURNING cassette_id";

                    var cassetteId = await con.QueryFirstOrDefaultAsync<string>(updateSessionSql, new
                    {
                        UnloadedAt = DateTime.UtcNow,
                        SessionId = (long)item.session_id
                    });

                    if (!string.IsNullOrEmpty(cassetteId))
                    {
                        // Обновляем статус кассеты
                        await con.ExecuteAsync(@"
                            UPDATE mes.cassettes 
                            SET status = 'Отпуск завершён'
                            WHERE cassette_id = @CassetteId AND status = 'Отправлена в печь'",
                            new { CassetteId = cassetteId });

                        // Обновляем статусы листов
                        await con.ExecuteAsync(@"
                            UPDATE mes.input_data 
                            SET status = 'Отпуск пройден'
                            WHERE mat_id IN (
                                SELECT scl.mat_id 
                                FROM mes.sheet_cassette_links scl
                                WHERE scl.cassette_id = @CassetteId
                            ) AND status = 'В печи отпуска'",
                            new { CassetteId = cassetteId });

                      
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка в TemperingAutoCompletionService");
            }
        }

        public override void Dispose()
        {
            _timer?.Dispose();
            base.Dispose();
        }
    }
}