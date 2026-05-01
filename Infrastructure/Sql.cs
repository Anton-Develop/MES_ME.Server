using System;

namespace MES_ME.Server.Infrastructure;

internal static class Sql
{
    // -----------------------------------------------------------------------
    // furnace_zone_data
    // -----------------------------------------------------------------------

    public const string ZoneHistory = """
        SELECT
            time, zone, sheet, slab, melt,
            state, zone_occup, plate_pos,
            seq_speed, proc_time_min, thickness, alarm_exist
        FROM plc.furnace_zone_data
        WHERE time BETWEEN @From AND @To
          AND (@Zone  IS NULL OR zone  = @Zone)
          AND (@Sheet IS NULL OR sheet = @Sheet)
        ORDER BY time DESC
        LIMIT @Limit
        """;

    public const string ZoneTrackBySheet = """
        SELECT
            time, zone, sheet, slab, melt,
            state, zone_occup, plate_pos,
            seq_speed, proc_time_min, thickness, alarm_exist
        FROM plc.furnace_zone_data
        WHERE sheet = @Sheet
          AND zone IN ('F1','F2','F3','F4')
        ORDER BY time
        """;

    // -----------------------------------------------------------------------
    // furnace_temperatures
    // -----------------------------------------------------------------------

    public const string TemperatureHistory = """
        SELECT
            date_trunc('minute', time) +
            (floor(EXTRACT(MINUTE FROM time) / @IntervalMinutes) * @IntervalMinutes) * INTERVAL '1 minute' AS time,
            AVG(z1_1_te) AS z1_1_te, AVG(z1_1_ref) AS z1_1_ref,
            AVG(z1_2_te) AS z1_2_te,
            AVG(z1_3_te) AS z1_3_te,
            AVG(z1_4_te) AS z1_4_te,
            AVG(z2_1_te) AS z2_1_te, AVG(z2_1_ref) AS z2_1_ref,
            AVG(z2_2_te) AS z2_2_te,
            AVG(z2_3_te) AS z2_3_te,
            AVG(z2_4_te) AS z2_4_te,
            AVG(z3_1_te) AS z3_1_te, AVG(z3_1_ref) AS z3_1_ref,
            AVG(z3_2_te) AS z3_2_te,
            AVG(z3_3_te) AS z3_3_te,
            AVG(z3_4_te) AS z3_4_te,
            AVG(z4_1_te) AS z4_1_te, AVG(z4_1_ref) AS z4_1_ref,
            AVG(z4_2_te) AS z4_2_te,
            AVG(z4_3_te) AS z4_3_te,
            AVG(z4_4_te) AS z4_4_te
        FROM plc.furnace_temperatures
        WHERE time BETWEEN @From AND @To
        GROUP BY 1
        ORDER BY 1
        """;

    public const string TemperatureByRange = """
        SELECT
            time,
            z1_1_te, z1_1_ref, z1_2_te, z1_3_te, z1_4_te,
            z2_1_te, z2_1_ref, z2_2_te, z2_3_te, z2_4_te,
            z3_1_te, z3_1_ref, z3_2_te, z3_3_te, z3_4_te,
            z4_1_te, z4_1_ref, z4_2_te, z4_3_te, z4_4_te
        FROM plc.furnace_temperatures
        WHERE time BETWEEN @From AND @To
        ORDER BY time
        """;

    // -----------------------------------------------------------------------
    // Массивы температур для сессии
    // -----------------------------------------------------------------------

    public const string GetTemperaturesArray = """
        SELECT 
            JSONB_AGG(z1_1_te ORDER BY time) AS z1_1,
            JSONB_AGG(z1_2_te ORDER BY time) AS z1_2,
            JSONB_AGG(z1_3_te ORDER BY time) AS z1_3,
            JSONB_AGG(z1_4_te ORDER BY time) AS z1_4,
            JSONB_AGG(z2_1_te ORDER BY time) AS z2_1,
            JSONB_AGG(z2_2_te ORDER BY time) AS z2_2,
            JSONB_AGG(z2_3_te ORDER BY time) AS z2_3,
            JSONB_AGG(z2_4_te ORDER BY time) AS z2_4,
            JSONB_AGG(z3_1_te ORDER BY time) AS z3_1,
            JSONB_AGG(z3_2_te ORDER BY time) AS z3_2,
            JSONB_AGG(z3_3_te ORDER BY time) AS z3_3,
            JSONB_AGG(z3_4_te ORDER BY time) AS z3_4,
            JSONB_AGG(z4_1_te ORDER BY time) AS z4_1,
            JSONB_AGG(z4_2_te ORDER BY time) AS z4_2,
            JSONB_AGG(z4_3_te ORDER BY time) AS z4_3,
            JSONB_AGG(z4_4_te ORDER BY time) AS z4_4,
            JSONB_AGG(time ORDER BY time) AS temps_time
        FROM plc.furnace_temperatures
        WHERE time BETWEEN @From AND @To
        """;

    // -----------------------------------------------------------------------
    // heating_sessions
    // -----------------------------------------------------------------------

    public const string FindCompletedSheets = """
        SELECT 
            sheet,
            MAX(slab) AS slab,
            MAX(melt) AS melt,
            MAX(part_no) AS part_no,
            MAX(alloy_code) AS alloy_code,
            MAX(alloy_code_text) AS alloy_code_text,
            MAX(thickness) AS thickness,
            MIN(CASE WHEN zone = 'F1' THEN time END) AS entered_at,
            MAX(CASE WHEN zone = 'F4' THEN time END) AS exited_at,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN zone = 'F1' THEN time END) - 
                               MIN(CASE WHEN zone = 'F1' THEN time END))) / 60 AS f1_min,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN zone = 'F2' THEN time END) - 
                               MIN(CASE WHEN zone = 'F2' THEN time END))) / 60 AS f2_min,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN zone = 'F3' THEN time END) - 
                               MIN(CASE WHEN zone = 'F3' THEN time END))) / 60 AS f3_min,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN zone = 'F4' THEN time END) - 
                               MIN(CASE WHEN zone = 'F4' THEN time END))) / 60 AS f4_min,
            CONCAT_WS('->',
                MAX(CASE WHEN zone = 'F1' THEN zone END),
                MAX(CASE WHEN zone = 'F2' THEN zone END),
                MAX(CASE WHEN zone = 'F3' THEN zone END),
                MAX(CASE WHEN zone = 'F4' THEN zone END)
            ) AS zones_path,
            BOOL_OR(alarm_exist) AS had_alarm
        FROM plc.furnace_zone_data
        WHERE zone IN ('F1', 'F2', 'F3', 'F4')
          AND zone_occup = TRUE
          AND sheet > 0
        GROUP BY sheet
        HAVING MAX(CASE WHEN zone = 'F4' THEN time END) < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
           AND sheet NOT IN (SELECT sheet FROM plc.heating_sessions)
        """;

    public const string FindMissedSheets = """
        WITH completed_sheets AS (
            SELECT 
                sheet,
                MAX(CASE WHEN zone = 'F4' THEN time END) AS last_seen
            FROM plc.furnace_zone_data
            WHERE zone IN ('F1', 'F2', 'F3', 'F4')
              AND sheet > 0
            GROUP BY sheet
            HAVING MAX(CASE WHEN zone = 'F4' THEN time END) < NOW() - INTERVAL '5 minutes'
        )
        SELECT fzd.*
        FROM plc.furnace_zone_data fzd
        INNER JOIN completed_sheets cs ON fzd.sheet = cs.sheet
        WHERE fzd.sheet NOT IN (SELECT sheet FROM plc.heating_sessions)
          AND fzd.time > NOW() - (@DaysBack || ' days')::INTERVAL
        """;

    public const string SessionCount = """
        SELECT COUNT(*)
        FROM plc.heating_sessions
        WHERE (@From      IS NULL OR entered_at >= @From)
          AND (@To        IS NULL OR entered_at <= @To)
          AND (@Slab      IS NULL OR slab       = @Slab)
          AND (@Melt      IS NULL OR melt       = @Melt)
          AND (@AlloyCode IS NULL OR alloy_code = @AlloyCode)
        """;

    public const string SessionList = """
        SELECT
            id, sheet, slab, melt, part_no, alloy_code, alloy_code_text,
            thickness, zones_path, entered_at, exited_at, total_min,
            f1_min, f2_min, f3_min, f4_min,
            had_alarm, created_at
        FROM plc.heating_sessions
        WHERE (@From      IS NULL OR entered_at >= @From)
          AND (@To        IS NULL OR entered_at <= @To)
          AND (@Slab      IS NULL OR slab       = @Slab)
          AND (@Melt      IS NULL OR melt       = @Melt)
          AND (@AlloyCode IS NULL OR alloy_code = @AlloyCode)
        ORDER BY entered_at DESC
        LIMIT @PageSize OFFSET @Offset
        """;

    public const string SessionBySheet = """
        SELECT
            id, sheet, slab, melt, part_no, alloy_code, alloy_code_text,
            thickness, zones_path, entered_at, exited_at, total_min,
            f1_min, f2_min, f3_min, f4_min,
            had_alarm, created_at
        FROM plc.heating_sessions
        WHERE sheet = @Sheet
        """;

    public const string UpsertHeatingSession = """
        INSERT INTO plc.heating_sessions (
            sheet, slab, melt, part_no, alloy_code, alloy_code_text,
            thickness, zones_path, entered_at, exited_at, total_min,
            f1_min, f2_min, f3_min, f4_min,
            temps_z1, temps_z2, temps_z3, temps_z4, temps_time, had_alarm
        ) VALUES (
            @Sheet, @Slab, @Melt, @PartNo, @AlloyCode, @AlloyCodeText,
            @Thickness, @ZonesPath, @EnteredAt, @ExitedAt, @TotalMin,
            @F1Min, @F2Min, @F3Min, @F4Min,
            @TempsZ1::jsonb, @TempsZ2::jsonb, @TempsZ3::jsonb, @TempsZ4::jsonb, @TempsTime::jsonb, @HadAlarm
        )
        ON CONFLICT (sheet) DO UPDATE SET
            exited_at      = EXCLUDED.exited_at,
            total_min      = EXCLUDED.total_min,
            zones_path     = EXCLUDED.zones_path,
            had_alarm      = EXCLUDED.had_alarm,
            temps_z1       = EXCLUDED.temps_z1,
            temps_z2       = EXCLUDED.temps_z2,
            temps_z3       = EXCLUDED.temps_z3,
            temps_z4       = EXCLUDED.temps_z4,
            temps_time     = EXCLUDED.temps_time
        """;
}