using System;
using System.Net;
using MES_ME.Server.DTOs;
using System.Text.Json;

namespace MES_ME.Server.Middleware;

/// <summary>
/// Перехватывает все необработанные исключения.
/// Возвращает единый JSON-конверт ApiError — фронт всегда знает формат ошибки.
/// </summary>
public sealed class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _log;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> log)
        => (_next, _log) = (next, log);

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
        {
            // Клиент закрыл соединение — не логируем как ошибку
            ctx.Response.StatusCode = 499;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unhandled exception {Method} {Path}",
                ctx.Request.Method, ctx.Request.Path);

            ctx.Response.StatusCode  = (int)HttpStatusCode.InternalServerError;
            ctx.Response.ContentType = "application/json";

            var error = new ApiError
            {
                Code    = "INTERNAL_ERROR",
                Message = "Внутренняя ошибка сервера",
                // Detail только в Development
                Detail  = ctx.RequestServices
                    .GetRequiredService<IHostEnvironment>()
                    .IsDevelopment() ? ex.ToString() : null
            };

            await ctx.Response.WriteAsync(
                JsonSerializer.Serialize(error,
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
        }
    }
}
