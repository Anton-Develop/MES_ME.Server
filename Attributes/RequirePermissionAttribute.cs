using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data;

namespace MES_ME.Server.Attributes
{
    public class RequirePermissionAttribute : ActionFilterAttribute
    {
        private readonly string _permission;

        public RequirePermissionAttribute(string permission)
        {
            _permission = permission;
        }

        public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var httpContext = context.HttpContext;
            var userIdClaim = httpContext.User.FindFirst("UserId");

            if (userIdClaim == null)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            var dbContext = (AppDbContext)context.HttpContext.RequestServices.GetService(typeof(AppDbContext))!;

            var userId = int.Parse(userIdClaim.Value);

            var hasPermission = await dbContext.Users
                .Where(u => u.Id == userId)
                .SelectMany(u => u.Role.RolePermissions)
                .AnyAsync(rp => rp.Permission.Name == _permission);

            if (!hasPermission)
            {
                context.Result = new ForbidResult(); // 403 Forbidden
                return;
            }

            await next();
        }
    }
}
