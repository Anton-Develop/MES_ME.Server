
using MES_ME.Server.Data;
using MES_ME.Server.OpcUa;
using MES_ME.Server.Repositories;
using MES_ME.Server.Workers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using OfficeOpenXml;
using System.Text;

namespace MES_ME.Server
{
  public class Program
  {
    public static void Main(string[] args)
    {
          
          
            var builder = WebApplication.CreateBuilder(args);

            AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
            AppContext.SetSwitch("Npgsql.DisableDateTimeInfinityConversions", true);

            // Add services to the container.
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

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
                            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)
                        )
                    };
                });
                  // Добавляем Authorization с политиками
                builder.Services.AddAuthorization(async options =>
                {
                    using var scope = builder.Services.BuildServiceProvider().CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                    // Загружаем все права из БД при запуске приложения
                    var allPermissions = await context.Permissions.Select(p => p.Name).ToListAsync();

                    foreach (var permission in allPermissions)
                    {
                        options.AddPolicy(permission, policy =>
                            policy.RequireAssertion(context =>
                            {
                                // Получаем список прав из Claims токена пользователя
                                var userPermissions = context.User.FindAll("permission").Select(c => c.Value);
                                // Проверяем, содержит ли список прав пользователя требуемое право
                                return userPermissions.Contains(permission);
                            }));
                    }
                });
            builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
{
            options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
              });
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowSpecificOrigin",
                    policy =>
                    {
                        policy.WithOrigins("http://localhost:3000") ///192.168.9.200
                              .AllowAnyHeader()
                              .AllowAnyMethod();
                    });
            });
            builder.Services.AddSingleton<NpgsqlDataSource>(sp =>
                {
                    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
                    return NpgsqlDataSource.Create(connectionString);
                });

            // SignalR
            builder.Services.AddSignalR(opts =>
            {
                opts.EnableDetailedErrors = builder.Environment.IsDevelopment();
                opts.MaximumReceiveMessageSize = 64 * 1024; // 64 KB
            });
            //Configurate OPC UA and registration
            var opcOpts = builder.Configuration
                                                .GetSection("OpcUa")
                                                .Get<OpcUaOptions>() ?? new OpcUaOptions();
            
            builder.Services.AddSingleton(opcOpts);
            builder.Services.AddSingleton<IOpcUaService, OpcUaService>();
            builder.Services.AddHostedService<OpcUaBackgroundService>();
            ///Worker для запси таблицы временно закомментим для отладки остального
           // builder.Services.AddScoped<IFurnaceRepository, FurnaceRepository>();
           // builder.Services.AddHostedService<HeatingSessionWorker>();
            builder.Services.AddControllers();

            var app = builder.Build();
           

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseHttpsRedirection();
            app.UseCors("AllowSpecificOrigin");
            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();

            //using (var scope = app.Services.CreateScope())
            //{
            //    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            //     RoutePermissionSeeder.SeedAsync(db);
            //}
            app.Run();
        }
  }
}
