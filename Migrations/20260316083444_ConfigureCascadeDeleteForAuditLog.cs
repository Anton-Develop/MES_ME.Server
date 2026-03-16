using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MES_ME.Server.Migrations
{
    /// <inheritdoc />
    public partial class ConfigureCascadeDeleteForAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Users_UserId",
                table: "AuditLogs");

            

            migrationBuilder.DropForeignKey(
                name: "FK_LoginLogs_Users_UserId",
                table: "LoginLogs");

            migrationBuilder.DropIndex(
                name: "IX_Users_Username",
                table: "Users");

          
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Users_UserId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_cassette_annealing_plan_links_cassettes_cassette_id",
                schema: "mes",
                table: "cassette_annealing_plan_links");

            migrationBuilder.DropForeignKey(
                name: "FK_LoginLogs_Users_UserId",
                table: "LoginLogs");

            
        }
    }
}
