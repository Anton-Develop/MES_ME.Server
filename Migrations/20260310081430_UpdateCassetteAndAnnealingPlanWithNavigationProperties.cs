using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MES_ME.Server.Migrations
{
    /// <inheritdoc />
    public partial class UpdateCassetteAndAnnealingPlanWithNavigationProperties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "mes");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "Users",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Roles",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "Timestamp",
                table: "LoginLogs",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "Timestamp",
                table: "AuditLogs",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

          /*  migrationBuilder.CreateTable(
                name: "annealing_batch_plans",
                schema: "mes",
                columns: table => new
                {
                    plan_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    plan_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    furnace_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    scheduled_start_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    scheduled_end_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    actual_start_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    actual_end_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_annealing_batch_plans", x => x.plan_id);
                });

            migrationBuilder.CreateTable(
                name: "AnnealingPlans",
                columns: table => new
                {
                    PlanId = table.Column<string>(type: "text", nullable: false),
                    PlanName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ScheduledStartTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ScheduledEndTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ActualStartTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ActualEndTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FurnaceNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CassettesCount = table.Column<int>(type: "integer", nullable: false),
                    TotalWeightKg = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnnealingPlans", x => x.PlanId);
                });

            migrationBuilder.CreateTable(
                name: "cassette_status_log",
                schema: "mes",
                columns: table => new
                {
                    log_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    cassette_id = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    old_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    new_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    changed_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    change_timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    comment = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cassette_status_log", x => x.log_id);
                });

            migrationBuilder.CreateTable(
                name: "cassettes",
                schema: "mes",
                columns: table => new
                {
                    cassette_id = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    current_operator_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    current_master_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cassettes", x => x.cassette_id);
                });

            migrationBuilder.CreateTable(
                name: "inputdata",
                schema: "mes",
                columns: table => new
                {
                    matid = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: true),
                    certificate_number = table.Column<string>(type: "text", nullable: true),
                    short_order_number = table.Column<string>(type: "text", nullable: true),
                    commercial_order_number = table.Column<string>(type: "text", nullable: true),
                    roll_date = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    melt_number = table.Column<string>(type: "text", nullable: true),
                    batch_number = table.Column<string>(type: "text", nullable: true),
                    pack_number = table.Column<string>(type: "text", nullable: true),
                    pack_system_number = table.Column<string>(type: "text", nullable: true),
                    steel_grade = table.Column<string>(type: "text", nullable: true),
                    sheet_dimensions = table.Column<string>(type: "text", nullable: true),
                    slab_number = table.Column<string>(type: "text", nullable: true),
                    actual_net_weight_kg = table.Column<decimal>(type: "numeric", nullable: true),
                    certificate_net_weight_kg = table.Column<decimal>(type: "numeric", nullable: true),
                    sheets_count = table.Column<int>(type: "integer", nullable: true),
                    sheet_weight_kg = table.Column<decimal>(type: "numeric", nullable: true),
                    raw_material_kg = table.Column<decimal>(type: "numeric", nullable: true),
                    sheet_number = table.Column<string>(type: "text", nullable: true),
                    quenching_date = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    quenching_status = table.Column<string>(type: "text", nullable: true),
                    marking = table.Column<string>(type: "text", nullable: true),
                    repeated_to_date = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    gp_acceptance_status_weight = table.Column<string>(type: "text", nullable: true),
                    np_acceptance_status_weight = table.Column<string>(type: "text", nullable: true),
                    scrap_acceptance_status_weight = table.Column<string>(type: "text", nullable: true),
                    actual_weight = table.Column<decimal>(type: "numeric", nullable: true),
                    non_return_scrap = table.Column<decimal>(type: "numeric", nullable: true),
                    trimming = table.Column<decimal>(type: "numeric", nullable: true),
                    flatness_mm = table.Column<decimal>(type: "numeric", nullable: true),
                    defect = table.Column<string>(type: "text", nullable: true),
                    note = table.Column<string>(type: "text", nullable: true),
                    np_act = table.Column<string>(type: "text", nullable: true),
                    mmk_claim_reason = table.Column<string>(type: "text", nullable: true),
                    np_decision = table.Column<string>(type: "text", nullable: true),
                    sample_cards_selection = table.Column<string>(type: "text", nullable: true),
                    sample_number_vk = table.Column<string>(type: "text", nullable: true),
                    ballistics_sample_send_date_1 = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ballistics_sample_send_date_2 = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ballistics_sample_send_date_3 = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    metallography_sample_send_date_1 = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    metallography_sample_send_date_2 = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    hardness_sample_send_date_1 = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    hardness_sample_send_date_2 = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    hardness_sample_send_date_3 = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    order_link = table.Column<string>(type: "text", nullable: true),
                    igk_link = table.Column<string>(type: "text", nullable: true),
                    testing_status = table.Column<string>(type: "text", nullable: true),
                    gp_vp_presentation_date = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    shipment_date = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    order_number = table.Column<string>(type: "text", nullable: true),
                    certificate_number_2 = table.Column<string>(type: "text", nullable: true),
                    shipped_sheets_weight_kg = table.Column<decimal>(type: "numeric", nullable: true),
                    sheet_weight_after_to_storage_kg = table.Column<decimal>(type: "numeric", nullable: true),
                    post_ship_diff = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inputdata", x => x.matid);
                });

            migrationBuilder.CreateTable(
                name: "cassette_annealing_plan_links",
                schema: "mes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CassetteId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PlanId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CassetteNumberInPlan = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cassette_annealing_plan_links", x => x.Id);
                    table.ForeignKey(
                        name: "FK_cassette_annealing_plan_links_AnnealingPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "AnnealingPlans",
                        principalColumn: "PlanId");
                    table.ForeignKey(
                        name: "FK_cassette_annealing_plan_links_cassettes_CassetteId",
                        column: x => x.CassetteId,
                        principalSchema: "mes",
                        principalTable: "cassettes",
                        principalColumn: "cassette_id");
                });

            migrationBuilder.CreateTable(
                name: "annealing_batch_plan_sheets",
                schema: "mes",
                columns: table => new
                {
                    link_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    plan_id = table.Column<int>(type: "integer", nullable: false),
                    matid = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    sequence_number = table.Column<int>(type: "integer", nullable: true),
                    status_override = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    execution_comment = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_annealing_batch_plan_sheets", x => x.link_id);
                    table.ForeignKey(
                        name: "FK_annealing_batch_plan_sheets_annealing_batch_plans_plan_id",
                        column: x => x.plan_id,
                        principalSchema: "mes",
                        principalTable: "annealing_batch_plans",
                        principalColumn: "plan_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_annealing_batch_plan_sheets_inputdata_matid",
                        column: x => x.matid,
                        principalSchema: "mes",
                        principalTable: "inputdata",
                        principalColumn: "matid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "annealing_schedule",
                schema: "mes",
                columns: table => new
                {
                    annealing_plan_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    matid = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    sequence_number = table.Column<int>(type: "integer", nullable: true),
                    furnace_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    furnace_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    scheduled_start_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    scheduled_end_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    actual_start_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    actual_end_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    execution_comment = table.Column<string>(type: "text", nullable: true),
                    executed_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    executed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_annealing_schedule", x => x.annealing_plan_id);
                    table.ForeignKey(
                        name: "FK_annealing_schedule_inputdata_matid",
                        column: x => x.matid,
                        principalSchema: "mes",
                        principalTable: "inputdata",
                        principalColumn: "matid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sheet_cassette_links",
                schema: "mes",
                columns: table => new
                {
                    link_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    matid = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    cassette_id = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    assigned_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sheet_cassette_links", x => x.link_id);
                    table.ForeignKey(
                        name: "FK_sheet_cassette_links_cassettes_cassette_id",
                        column: x => x.cassette_id,
                        principalSchema: "mes",
                        principalTable: "cassettes",
                        principalColumn: "cassette_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_sheet_cassette_links_inputdata_matid",
                        column: x => x.matid,
                        principalSchema: "mes",
                        principalTable: "inputdata",
                        principalColumn: "matid",
                        onDelete: ReferentialAction.Cascade);
                });
*/
            migrationBuilder.CreateIndex(
                name: "IX_annealing_batch_plan_sheets_matid",
                schema: "mes",
                table: "annealing_batch_plan_sheets",
                column: "matid");

            migrationBuilder.CreateIndex(
                name: "IX_annealing_batch_plan_sheets_plan_id",
                schema: "mes",
                table: "annealing_batch_plan_sheets",
                column: "plan_id");

            migrationBuilder.CreateIndex(
                name: "IX_annealing_schedule_matid",
                schema: "mes",
                table: "annealing_schedule",
                column: "matid");

            migrationBuilder.CreateIndex(
                name: "IX_cassette_annealing_plan_links_CassetteId",
                schema: "mes",
                table: "cassette_annealing_plan_links",
                column: "CassetteId");

            migrationBuilder.CreateIndex(
                name: "IX_cassette_annealing_plan_links_PlanId_CassetteId",
                schema: "mes",
                table: "cassette_annealing_plan_links",
                columns: new[] { "PlanId", "CassetteId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_cassette_annealing_plan_links_PlanId_CassetteNumberInPlan",
                schema: "mes",
                table: "cassette_annealing_plan_links",
                columns: new[] { "PlanId", "CassetteNumberInPlan" },
                unique: true,
                filter: "[CassetteNumberInPlan] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_sheet_cassette_links_cassette_id",
                schema: "mes",
                table: "sheet_cassette_links",
                column: "cassette_id");

            migrationBuilder.CreateIndex(
                name: "IX_sheet_cassette_links_matid",
                schema: "mes",
                table: "sheet_cassette_links",
                column: "matid",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /*
            migrationBuilder.DropTable(
                name: "annealing_batch_plan_sheets",
                schema: "mes");

            migrationBuilder.DropTable(
                name: "annealing_schedule",
                schema: "mes");

            migrationBuilder.DropTable(
                name: "cassette_annealing_plan_links",
                schema: "mes");

            migrationBuilder.DropTable(
                name: "cassette_status_log",
                schema: "mes");

            migrationBuilder.DropTable(
                name: "sheet_cassette_links",
                schema: "mes");

            migrationBuilder.DropTable(
                name: "annealing_batch_plans",
                schema: "mes");

            migrationBuilder.DropTable(
                name: "AnnealingPlans");

            migrationBuilder.DropTable(
                name: "cassettes",
                schema: "mes");

            migrationBuilder.DropTable(
                name: "inputdata",
                schema: "mes");
*/
            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Roles",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "Timestamp",
                table: "LoginLogs",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "Timestamp",
                table: "AuditLogs",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone");
        }
    }
}
