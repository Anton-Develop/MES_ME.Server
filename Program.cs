using MES_ME.Server.Data;
using MES_ME.Server.Hubs;
using MES_ME.Server.OpcUa;
using MES_ME.Server.Repositories;
using MES_ME.Server.Workers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using System.Text;

namespace MES_ME.Server;

public class Program
{
    // ✅ Main стал async, чтобы можно было загружать политики после Build()
    public static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Временные переключатели Npgsql (для совместимости со старым кодом)
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
        AppContext.SetSwitch("Npgsql.DisableDateTimeInfinityConversions", true);

        // ============================
        // DbContext + DataSource
        // ============================
        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

        builder.Services.AddSingleton<NpgsqlDataSource>(sp =>
        {
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            var sourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
            sourceBuilder.ConnectionStringBuilder.CommandTimeout = 120; // 2 минуты по умолчанию
            return sourceBuilder.Build();
        });

        // ============================
        // ✅ КРИТИЧНО: StopHost вместо Ignore
        // Теперь при падении воркера приложение остановится, 
        // и оркестратор (Docker/K8s) перезапустит контейнер
        // ============================
        builder.Services.Configure<HostOptions>(options =>
        {
            options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.StopHost;
        });

        // ============================
        // Authentication
        // ============================
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = builder.Configuration["Jwt:Issuer"],
                    ValidAudience = builder.Configuration["Jwt:Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
                };
            });

        // ✅ Базовая регистрация Authorization (без политик из БД)
        // Политики добавим позже, после builder.Build()
        builder.Services.AddAuthorization();

        // ============================
        // JSON Options
        // ============================
        builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
        {
            options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        });

        // ============================
        // ✅ КРИТИЧНО: Безопасный CORS
        // Убрали SetIsOriginAllowed(_ => true) — он разрешал ЛЮБОЙ origin
        // ============================
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowSpecificOrigin", policy =>
            {
                policy.WithOrigins(
                        "http://localhost:3000",
                        "http://192.168.9.64:3000"
                        // TODO: добавить production домен при деплое:
                        // "https://your-production-domain.com"
                    )
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        // ============================
        // SignalR
        // ============================
        builder.Services.AddSignalR(opts =>
        {
            opts.EnableDetailedErrors = builder.Environment.IsDevelopment();
            opts.MaximumReceiveMessageSize = 128 * 1024; // 128 KB
        });

        // ============================
        // Memory Cache (для AnnealingCompletionService и др.)
        // ============================
        builder.Services.AddMemoryCache();

        // ============================
        // OPC UA
        // ============================
        var opcOpts = builder.Configuration.GetSection("OpcUa").Get<OpcUaOptions>() ?? new OpcUaOptions();
        builder.Services.AddSingleton(opcOpts);
        builder.Services.AddSingleton<IOpcUaService, OpcUaService>();
        builder.Services.AddHostedService<OpcUaBackgroundService>();

        // ============================
        // Repositories
        // ============================
        builder.Services.AddScoped<IFurnaceRepository, FurnaceRepository>();
        builder.Services.AddScoped<IQuenchingRepository, QuenchingRepository>();
        builder.Services.AddScoped<ITemperingRepository, TemperingRepository>(); // ✅ НОВЫЙ

        // ============================
        // Workers (Background Services)
        // ============================
        builder.Services.AddHostedService<HeatingSessionWorker>();
        builder.Services.AddHostedService<QuenchingSessionWorker>();
        builder.Services.AddHostedService<TemperingSessionWorker>(); // ✅ ВКЛЮЧЕН
        builder.Services.AddHostedService<TemperingAutoCompletionService>();
        builder.Services.AddHostedService<AnnealingCompletionService>(); // Раскомментируй после тестов

        builder.Services.AddControllers();

        // ============================
        // Build Application
        // ============================
        var app = builder.Build();

        // ============================
        // ✅ КРИТИЧНО: Загрузка политик авторизации ИЗ БД
        // Выполняется ПОСЛЕ Build(), когда DI уже собран.
        // Без BuildServiceProvider() — нет утечки памяти!
        // ============================
        using (var scope = app.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var authOptions = app.Services.GetRequiredService<IOptions<AuthorizationOptions>>().Value;

            try
            {
                var allPermissions = await dbContext.Permissions
                    .Select(p => p.Name)
                    .ToListAsync();

                foreach (var permission in allPermissions)
                {
                    authOptions.AddPolicy(permission, policy =>
                        policy.RequireAssertion(ctx =>
                        {
                            var userPermissions = ctx.User.FindAll("permission")
                                .Select(c => c.Value);
                            return userPermissions.Contains(permission);
                        }));
                }

                app.Logger.LogInformation("✅ Loaded {Count} authorization policies from DB", allPermissions.Count);
            }
            catch (Exception ex)
            {
                app.Logger.LogError(ex, "❌ Failed to load authorization policies from DB");
                // Не падаем — приложение запустится, но без динамических политик
            }
        }

        // ============================
        // HTTP Pipeline
        // ============================
        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        app.UseHttpsRedirection();
        app.UseCors("AllowSpecificOrigin");
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapHub<OpcUaHub>("/hubs/opc");
        app.MapControllers();

        await app.RunAsync();
    }
}