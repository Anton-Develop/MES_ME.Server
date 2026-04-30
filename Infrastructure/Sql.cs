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

    /// <summary>
    /// Даунсемплинг: усредняем по бакетам @IntervalMin минут.
    /// </summary>
    public const string TemperatureHistory = """
        SELECT
            date_trunc('minute', time)
              + ( EXTRACT(MINUTE FROM time)::INT
                  / @IntervalMinutes  * @IntervalMinutes 
                ) * INTERVAL '1 minute'             AS time,
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
    // heating_sessions
    // -----------------------------------------------------------------------

    public const string SessionCount = """
        SELECT COUNT(*)
        FROM heating_sessions
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
            avg_z3_1, avg_z3_2, avg_z3_3, avg_z3_4,
            avg_z4_1, avg_z4_2, avg_z4_3, avg_z4_4,
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
            avg_z3_1, avg_z3_2, avg_z3_3, avg_z3_4,
            avg_z4_1, avg_z4_2, avg_z4_3, avg_z4_4,
            had_alarm, created_at
        FROM plc.heating_sessions
        WHERE sheet = @Sheet
        """;

    // -----------------------------------------------------------------------
    // Worker — поиск завершённых листов для записи в heating_sessions
    // -----------------------------------------------------------------------

    /*public const string FindCompletedSheets = """
        WITH zone_passages AS (
            SELECT
                sheet, slab, melt, part_no, alloy_code, alloy_code_text,
                thickness, zone,
                MIN(time)            AS entry_time,
                MAX(time)            AS exit_time,
                MAX(proc_time_min)   AS zone_proc_min,
                BOOL_OR(alarm_exist) AS zone_had_alarm
            FROM plc.furnace_zone_data
            WHERE zone     IN ('F1','F2','F3','F4')
              AND zone_occup = TRUE
              AND sheet      > 0
            GROUP BY sheet, slab, melt, part_no, alloy_code, alloy_code_text, thickness, zone
        )
        SELECT
            sheet, slab, melt, part_no, alloy_code, alloy_code_text, thickness,
            MIN(entry_time)    AS entered_at,
            MAX(exit_time)     AS exited_at,
            MAX(CASE WHEN zone = 'F1' THEN zone_proc_min END) AS f1_min,
            MAX(CASE WHEN zone = 'F2' THEN zone_proc_min END) AS f2_min,
            MAX(CASE WHEN zone = 'F3' THEN zone_proc_min END) AS f3_min,
            MAX(CASE WHEN zone = 'F4' THEN zone_proc_min END) AS f4_min,
            STRING_AGG(zone, '->' ORDER BY MIN(entry_time))    AS zones_path,
            BOOL_OR(zone_had_alarm)                            AS had_alarm
        FROM zone_passages
        GROUP BY sheet, slab, melt, part_no, alloy_code, alloy_code_text, thickness
        HAVING MAX(exit_time) < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
           AND sheet NOT IN (SELECT sheet FROM plc.heating_sessions)
        """;
*/
public const string FindCompletedSheets = """
    SELECT 
        sheet,
        MAX(slab) AS slab,
        MAX(melt) AS melt,
        MAX(part_no) AS part_no,
        MAX(alloy_code) AS alloy_code,
        MAX(alloy_code_text) AS alloy_code_text,
        MAX(thickness) AS thickness,
        MAX(CASE WHEN zone = 'F1' THEN proc_time_min END) AS f1_min,
        MAX(CASE WHEN zone = 'F2' THEN proc_time_min END) AS f2_min,
        MAX(CASE WHEN zone = 'F3' THEN proc_time_min END) AS f3_min,
        MAX(CASE WHEN zone = 'F4' THEN proc_time_min END) AS f4_min,
        CONCAT_WS('->',
            MAX(CASE WHEN zone = 'F1' THEN zone END),
            MAX(CASE WHEN zone = 'F2' THEN zone END),
            MAX(CASE WHEN zone = 'F3' THEN zone END),
            MAX(CASE WHEN zone = 'F4' THEN zone END)
        ) AS zones_path,
        BOOL_OR(alarm_exist) AS had_alarm,
        MIN(time) AS entered_at,
        MAX(time) AS exited_at
    FROM plc.furnace_zone_data
    WHERE zone IN ('F1', 'F2', 'F3', 'F4')
      AND zone_occup = TRUE
      AND sheet > 0
    GROUP BY sheet
    HAVING MAX(CASE WHEN zone = 'F4' THEN time END) < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
       AND sheet NOT IN (SELECT sheet FROM plc.heating_sessions)
    """;
    public const string AvgTempsForSession = """
        SELECT
            AVG(z1_1_te) AS avg_z1_1, AVG(z1_2_te) AS avg_z1_2,
            AVG(z2_1_te) AS avg_z2_1, AVG(z2_2_te) AS avg_z2_2,
            AVG(z3_1_te) AS avg_z3_1, AVG(z3_2_te) AS avg_z3_2,
            AVG(z3_3_te) AS avg_z3_3, AVG(z3_4_te) AS avg_z3_4,
            AVG(z4_1_te) AS avg_z4_1, AVG(z4_2_te) AS avg_z4_2,
            AVG(z4_3_te) AS avg_z4_3, AVG(z4_4_te) AS avg_z4_4
        FROM plc.furnace_temperatures
        WHERE time BETWEEN @From AND @To
        """;

    public const string UpsertHeatingSession = """
        INSERT INTO plc.heating_sessions (
            sheet, slab, melt, part_no, alloy_code, alloy_code_text,
            thickness, zones_path, entered_at, exited_at, total_min,
            f1_min, f2_min, f3_min, f4_min,
            avg_z1_1, avg_z1_2, avg_z2_1, avg_z2_2,
            avg_z3_1, avg_z3_2, avg_z3_3, avg_z3_4,
            avg_z4_1, avg_z4_2, avg_z4_3, avg_z4_4,
            had_alarm
        ) VALUES (
            @Sheet, @Slab, @Melt, @PartNo, @AlloyCode, @AlloyCodeText,
            @Thickness, @ZonesPath, @EnteredAt, @ExitedAt, @TotalMin,
            @F1Min, @F2Min, @F3Min, @F4Min,
            @AvgZ1_1, @AvgZ1_2, @AvgZ2_1, @AvgZ2_2,
            @AvgZ3_1, @AvgZ3_2, @AvgZ3_3, @AvgZ3_4,
            @AvgZ4_1, @AvgZ4_2, @AvgZ4_3, @AvgZ4_4,
            @HadAlarm
        )
        ON CONFLICT (sheet) DO UPDATE SET
            exited_at      = EXCLUDED.exited_at,
            total_min      = EXCLUDED.total_min,
            zones_path     = EXCLUDED.zones_path,
            had_alarm      = EXCLUDED.had_alarm,
            avg_z3_1       = EXCLUDED.avg_z3_1,
            avg_z3_2       = EXCLUDED.avg_z3_2,
            avg_z3_3       = EXCLUDED.avg_z3_3,
            avg_z3_4       = EXCLUDED.avg_z3_4,
            avg_z4_1       = EXCLUDED.avg_z4_1,
            avg_z4_2       = EXCLUDED.avg_z4_2,
            avg_z4_3       = EXCLUDED.avg_z4_3,
            avg_z4_4       = EXCLUDED.avg_z4_4
        """;
}
