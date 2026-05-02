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
    WITH
    -- Входы в F1 (начало новой сессии)
    f1_entries AS (
        SELECT sheet, melt, part_no, pack, MIN(time) AS entry_time
        FROM plc.furnace_zone_data
        WHERE zone = 'F1' AND zone_occup = TRUE AND sheet > 0
        GROUP BY sheet, melt, part_no, pack,
                 -- Группируем непрерывные пребывания: новая группа если пауза > 1 мин
                 (SELECT COUNT(*) FROM plc.furnace_zone_data prev
                  WHERE prev.sheet   = furnace_zone_data.sheet
                    AND prev.melt    = furnace_zone_data.melt
                    AND prev.zone    = 'F1'
                    AND prev.zone_occup = TRUE
                    AND prev.time < furnace_zone_data.time
                    AND prev.time > furnace_zone_data.time - INTERVAL '1 minute')
    ),
    -- Нумеруем сессии по времени входа в F1
    sessions AS (
        SELECT *,
            ROW_NUMBER() OVER (
                PARTITION BY sheet, melt, part_no, pack
                ORDER BY entry_time
            ) - 1 AS reheat_num   -- 0 = первый нагрев
        FROM f1_entries
    ),
    -- Для каждой сессии берём данные до следующего входа
    session_bounds AS (
        SELECT
            s.*,
            COALESCE(
                LEAD(s.entry_time) OVER (
                    PARTITION BY s.sheet, s.melt, s.part_no, s.pack
                    ORDER BY s.entry_time
                ),
                'infinity'::timestamptz
            ) AS next_entry_time
        FROM sessions s
    ),
    -- Агрегируем данные зон в рамках каждой сессии
    agg AS (
        SELECT
            sb.sheet, sb.reheat_num,
            MAX(fzd.melt)            AS melt,
            MAX(fzd.slab)            AS slab,
            MAX(fzd.part_no)         AS part_no,
            MAX(fzd.pack)            AS pack,
            MAX(fzd.alloy_code)      AS alloy_code,
            MAX(fzd.alloy_code_text) AS alloy_code_text,
            MAX(fzd.thickness)       AS thickness,
            MIN(fzd.time)            AS entered_at,
            MAX(fzd.time)            AS exited_at,
            EXTRACT(EPOCH FROM (
                MAX(CASE WHEN fzd.zone='F1' THEN fzd.time END) -
                MIN(CASE WHEN fzd.zone='F1' THEN fzd.time END)
            )) / 60 AS f1_min,
            EXTRACT(EPOCH FROM (
                MAX(CASE WHEN fzd.zone='F2' THEN fzd.time END) -
                MIN(CASE WHEN fzd.zone='F2' THEN fzd.time END)
            )) / 60 AS f2_min,
            EXTRACT(EPOCH FROM (
                MAX(CASE WHEN fzd.zone='F3' THEN fzd.time END) -
                MIN(CASE WHEN fzd.zone='F3' THEN fzd.time END)
            )) / 60 AS f3_min,
            EXTRACT(EPOCH FROM (
                MAX(CASE WHEN fzd.zone='F4' THEN fzd.time END) -
                MIN(CASE WHEN fzd.zone='F4' THEN fzd.time END)
            )) / 60 AS f4_min,
            CONCAT_WS('->',
                MAX(CASE WHEN fzd.zone='F1' THEN fzd.zone END),
                MAX(CASE WHEN fzd.zone='F2' THEN fzd.zone END),
                MAX(CASE WHEN fzd.zone='F3' THEN fzd.zone END),
                MAX(CASE WHEN fzd.zone='F4' THEN fzd.zone END)
            ) AS zones_path,
            BOOL_OR(fzd.alarm_exist) AS had_alarm
        FROM session_bounds sb
        JOIN plc.furnace_zone_data fzd
          ON fzd.sheet   = sb.sheet
         AND fzd.melt    = sb.melt
         AND fzd.part_no = sb.part_no
         AND fzd.pack    = sb.pack
         AND fzd.zone IN ('F1','F2','F3','F4')
         AND fzd.zone_occup = TRUE
         AND fzd.time >= sb.entry_time
         AND fzd.time <  sb.next_entry_time  -- строго до следующей сессии
        GROUP BY sb.sheet, sb.melt, sb.part_no, sb.pack, sb.reheat_num
    )
    SELECT agg.*
    FROM agg
    LEFT JOIN plc.heating_sessions hs
           ON hs.sheet      = agg.sheet
          AND hs.melt       = agg.melt
          AND hs.part_no    = agg.part_no
          AND hs.pack       = agg.pack
          AND hs.reheat_num = agg.reheat_num
    WHERE hs.id IS NULL
      AND agg.exited_at IS NOT NULL
      AND agg.exited_at < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
    ORDER BY agg.entered_at
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
    public const string SessionsBySheetKey = """
    SELECT
        id, sheet, slab, melt, part_no, pack, reheat_num, business_key,
        alloy_code, alloy_code_text, thickness, zones_path,
        entered_at, exited_at, total_min,
        f1_min, f2_min, f3_min, f4_min,
        avg_z3_1, avg_z3_2, avg_z3_3, avg_z3_4,
        avg_z4_1, avg_z4_2, avg_z4_3, avg_z4_4,
        had_alarm, created_at
    FROM plc.heating_sessions
    WHERE sheet   = @Sheet
      AND melt    = @Melt
      AND part_no = @PartNo
      AND pack    = @Pack
    ORDER BY reheat_num
    """;

    public const string SessionByKey = """
    SELECT *
    FROM plc.heating_sessions
    WHERE business_key = @Key
    """;


    public const string SessionBySheet = """
    SELECT * FROM plc.heating_sessions
    WHERE sheet = @Sheet
    ORDER BY entered_at DESC
    """;



    public const string UpsertHeatingSession = """
    INSERT INTO plc.heating_sessions (
        sheet, slab, melt, part_no, pack, reheat_num,
        alloy_code, alloy_code_text,
        thickness, zones_path, entered_at, exited_at, total_min,
        f1_min, f2_min, f3_min, f4_min,
        avg_z1_1, avg_z1_2, avg_z2_1, avg_z2_2,
        avg_z3_1, avg_z3_2, avg_z3_3, avg_z3_4,
        avg_z4_1, avg_z4_2, avg_z4_3, avg_z4_4,
        temps_z1, temps_z2, temps_z3, temps_z4, temps_time,
        had_alarm
    ) VALUES (
        @Sheet, @Slab, @Melt, @PartNo, @Pack, @ReheatNum,
        @AlloyCode, @AlloyCodeText,
        @Thickness, @ZonesPath, @EnteredAt, @ExitedAt, @TotalMin,
        @F1Min, @F2Min, @F3Min, @F4Min,
        @AvgZ1_1, @AvgZ1_2, @AvgZ2_1, @AvgZ2_2,
        @AvgZ3_1, @AvgZ3_2, @AvgZ3_3, @AvgZ3_4,
        @AvgZ4_1, @AvgZ4_2, @AvgZ4_3, @AvgZ4_4,
        @TempsZ1::jsonb, @TempsZ2::jsonb, @TempsZ3::jsonb,
        @TempsZ4::jsonb, @TempsTime::jsonb,
        @HadAlarm
    )
    ON CONFLICT (business_key) DO UPDATE SET
        exited_at  = EXCLUDED.exited_at,
        total_min  = EXCLUDED.total_min,
        zones_path = EXCLUDED.zones_path,
        had_alarm  = EXCLUDED.had_alarm,
        avg_z1_1 = EXCLUDED.avg_z1_1, avg_z1_2 = EXCLUDED.avg_z1_2,
        avg_z2_1 = EXCLUDED.avg_z2_1, avg_z2_2 = EXCLUDED.avg_z2_2,
        avg_z3_1 = EXCLUDED.avg_z3_1, avg_z3_2 = EXCLUDED.avg_z3_2,
        avg_z3_3 = EXCLUDED.avg_z3_3, avg_z3_4 = EXCLUDED.avg_z3_4,
        avg_z4_1 = EXCLUDED.avg_z4_1, avg_z4_2 = EXCLUDED.avg_z4_2,
        avg_z4_3 = EXCLUDED.avg_z4_3, avg_z4_4 = EXCLUDED.avg_z4_4,
        temps_z1 = EXCLUDED.temps_z1, temps_z2 = EXCLUDED.temps_z2,
        temps_z3 = EXCLUDED.temps_z3, temps_z4 = EXCLUDED.temps_z4,
        temps_time = EXCLUDED.temps_time
    """;

}