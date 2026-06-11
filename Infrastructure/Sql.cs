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
        JSONB_AGG(z1_1_te  ORDER BY time) AS z1_1,
        JSONB_AGG(z1_2_te  ORDER BY time) AS z1_2,
        JSONB_AGG(z1_3_te  ORDER BY time) AS z1_3,
        JSONB_AGG(z1_4_te  ORDER BY time) AS z1_4,
        JSONB_AGG(z2_1_te  ORDER BY time) AS z2_1,
        JSONB_AGG(z2_2_te  ORDER BY time) AS z2_2,
        JSONB_AGG(z2_3_te  ORDER BY time) AS z2_3,
        JSONB_AGG(z2_4_te  ORDER BY time) AS z2_4,
        JSONB_AGG(z3_1_te  ORDER BY time) AS z3_1,
        JSONB_AGG(z3_2_te  ORDER BY time) AS z3_2,
        JSONB_AGG(z3_3_te  ORDER BY time) AS z3_3,
        JSONB_AGG(z3_4_te  ORDER BY time) AS z3_4,
        JSONB_AGG(z4_1_te  ORDER BY time) AS z4_1,
        JSONB_AGG(z4_2_te  ORDER BY time) AS z4_2,
        JSONB_AGG(z4_3_te  ORDER BY time) AS z4_3,
        JSONB_AGG(z4_4_te  ORDER BY time) AS z4_4,
        JSONB_AGG(time     ORDER BY time) AS temps_time,
        -- Задания — у каждой зоны по одному заданию на все термопары
        JSONB_AGG(z1_1_ref ORDER BY time) AS z1_1_ref,
        JSONB_AGG(z2_1_ref ORDER BY time) AS z2_1_ref,
        JSONB_AGG(z3_1_ref ORDER BY time) AS z3_1_ref,
        JSONB_AGG(z4_1_ref ORDER BY time) AS z4_1_ref
    FROM plc.furnace_temperatures
    WHERE time BETWEEN @From AND @To
    """;


    // -----------------------------------------------------------------------
    // heating_sessions
    // -----------------------------------------------------------------------

    public const string FindCompletedSheets = """
    WITH
    presence AS (
        SELECT sheet, melt, part_no, pack, zone, time, alarm_exist,
            time - LAG(time) OVER (PARTITION BY sheet, melt, part_no, pack ORDER BY time) AS gap
        FROM plc.furnace_zone_data
        WHERE zone IN ('F1','F2','F3','F4')
          AND zone_occup = TRUE
          AND sheet > 0 AND part_no > 0 AND pack > 0
          AND time > NOW() - INTERVAL '3 days' 
    ),
    with_flag AS (
        SELECT *,
            CASE WHEN gap IS NULL OR gap > INTERVAL '30 minutes' THEN 1 ELSE 0 END AS is_new_session
        FROM presence
    ),
    with_session AS (
        SELECT *,
            SUM(is_new_session) OVER (
                PARTITION BY sheet, melt, part_no, pack 
                ORDER BY time
                ROWS UNBOUNDED PRECEDING
            ) - 1 AS pass_id
        FROM with_flag
    ),
    agg AS (
        SELECT 
            ws.sheet, ws.melt, ws.part_no, ws.pack, ws.pass_id,
            MIN(ws.time) AS entered_at,
            MAX(ws.time) AS exited_at,
            EXTRACT(EPOCH FROM (MAX(ws.time) - MIN(ws.time)))/60 AS total_minutes,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F1' THEN ws.time END) - MIN(CASE WHEN ws.zone = 'F1' THEN ws.time END)))/60 AS f1_min,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F2' THEN ws.time END) - MIN(CASE WHEN ws.zone = 'F2' THEN ws.time END)))/60 AS f2_min,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F3' THEN ws.time END) - MIN(CASE WHEN ws.zone = 'F3' THEN ws.time END)))/60 AS f3_min,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F4' THEN ws.time END) - MIN(CASE WHEN ws.zone = 'F4' THEN ws.time END)))/60 AS f4_min,
            MIN(CASE WHEN ws.zone = 'F1' THEN ws.time END) AS entered_at_f1,
            MAX(CASE WHEN ws.zone = 'F1' THEN ws.time END) AS exited_at_f1,
            MIN(CASE WHEN ws.zone = 'F2' THEN ws.time END) AS entered_at_f2,
            MAX(CASE WHEN ws.zone = 'F2' THEN ws.time END) AS exited_at_f2,
            MIN(CASE WHEN ws.zone = 'F3' THEN ws.time END) AS entered_at_f3,
            MAX(CASE WHEN ws.zone = 'F3' THEN ws.time END) AS exited_at_f3,
            MIN(CASE WHEN ws.zone = 'F4' THEN ws.time END) AS entered_at_f4,
            MAX(CASE WHEN ws.zone = 'F4' THEN ws.time END) AS exited_at_f4,
            BOOL_OR(ws.alarm_exist) AS had_alarm,
            MAX(fzd.slab) AS slab,
            MAX(fzd.alloy_code) AS alloy_code,
            MAX(fzd.alloy_code_text) AS alloy_code_text,
            MAX(fzd.thickness) AS thickness
        FROM with_session ws
        JOIN plc.furnace_zone_data fzd
          ON fzd.sheet = ws.sheet AND fzd.melt = ws.melt AND fzd.part_no = ws.part_no 
         AND fzd.pack = ws.pack AND fzd.time = ws.time AND fzd.zone = ws.zone
        GROUP BY ws.sheet, ws.melt, ws.part_no, ws.pack, ws.pass_id
    ),
    zones_paths AS (
        SELECT sheet, melt, part_no, pack, pass_id,
            STRING_AGG(zone, '->' ORDER BY first_time) AS zones_path
        FROM (
            SELECT sheet, melt, part_no, pack, pass_id, zone, MIN(time) AS first_time
            FROM with_session
            GROUP BY sheet, melt, part_no, pack, pass_id, zone
        ) zone_order
        GROUP BY sheet, melt, part_no, pack, pass_id
    ),
    unprocessed AS (
        SELECT agg.*, zp.zones_path,
            ROW_NUMBER() OVER (PARTITION BY agg.sheet, agg.melt, agg.part_no, agg.pack ORDER BY agg.entered_at) AS rn
        FROM agg
        LEFT JOIN plc.heating_sessions hs
          ON hs.sheet = agg.sheet AND hs.melt = agg.melt AND hs.part_no = agg.part_no 
         AND hs.pack = agg.pack AND hs.entered_at between agg.entered_at - INTERVAL '5 minute' and agg.entered_at + INTERVAL '5 minute'
        LEFT JOIN zones_paths zp
          ON zp.sheet = agg.sheet AND zp.melt = agg.melt AND zp.part_no = agg.part_no 
         AND zp.pack = agg.pack AND zp.pass_id = agg.pass_id
        WHERE hs.id IS NULL
          AND agg.exited_at IS NOT NULL
          AND agg.exited_at < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
          AND agg.total_minutes <= 50
    ),
    existing_max AS (
        SELECT sheet, melt, part_no, pack, 
               COALESCE(MAX(reheat_num), -1) AS max_reheat
        FROM plc.heating_sessions
        GROUP BY sheet, melt, part_no, pack
    )
    SELECT 
        up.sheet, up.melt, up.part_no, up.pack,
        up.entered_at, up.exited_at, up.total_minutes,
        up.f1_min, up.f2_min, up.f3_min, up.f4_min,
        up.entered_at_f1, up.exited_at_f1, up.entered_at_f2, up.exited_at_f2,
        up.entered_at_f3, up.exited_at_f3, up.entered_at_f4, up.exited_at_f4,
        up.had_alarm, up.slab, up.alloy_code, up.alloy_code_text, up.thickness,
        up.zones_path,
        COALESCE(em.max_reheat, -1) + up.rn AS reheat_num
    FROM unprocessed up
    LEFT JOIN existing_max em 
      ON em.sheet = up.sheet AND em.melt = up.melt 
     AND em.part_no = up.part_no AND em.pack = up.pack
    ORDER BY up.entered_at
    """;

    public const string FindMissedSheets = """
    WITH
    presence AS (
        SELECT sheet, melt, part_no, pack, zone, time, alarm_exist,
            time - LAG(time) OVER (PARTITION BY sheet, melt, part_no, pack ORDER BY time) AS gap
        FROM plc.furnace_zone_data
        WHERE zone IN ('F1','F2','F3','F4')
          AND zone_occup = TRUE
          AND sheet > 0 AND part_no > 0 AND pack > 0
          AND time > NOW() - (@DaysBack || ' days')::INTERVAL
    ),
    with_flag AS (
        SELECT *,
            CASE WHEN gap IS NULL OR gap > INTERVAL '30 minutes' THEN 1 ELSE 0 END AS is_new_session
        FROM presence
    ),
    with_session AS (
        SELECT *,
            SUM(is_new_session) OVER (
                PARTITION BY sheet, melt, part_no, pack 
                ORDER BY time
                ROWS UNBOUNDED PRECEDING
            ) - 1 AS pass_id
        FROM with_flag
    ),
    agg AS (
        SELECT 
            ws.sheet, ws.melt, ws.part_no, ws.pack, ws.pass_id,
            MIN(ws.time) AS entered_at,
            MAX(ws.time) AS exited_at,
            EXTRACT(EPOCH FROM (MAX(ws.time) - MIN(ws.time)))/60 AS total_minutes,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F1' THEN ws.time END) - MIN(CASE WHEN ws.zone = 'F1' THEN ws.time END)))/60 AS f1_min,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F2' THEN ws.time END) - MIN(CASE WHEN ws.zone = 'F2' THEN ws.time END)))/60 AS f2_min,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F3' THEN ws.time END) - MIN(CASE WHEN ws.zone = 'F3' THEN ws.time END)))/60 AS f3_min,
            EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F4' THEN ws.time END) - MIN(CASE WHEN ws.zone = 'F4' THEN ws.time END)))/60 AS f4_min,
            MIN(CASE WHEN ws.zone = 'F1' THEN ws.time END) AS entered_at_f1,
            MAX(CASE WHEN ws.zone = 'F1' THEN ws.time END) AS exited_at_f1,
            MIN(CASE WHEN ws.zone = 'F2' THEN ws.time END) AS entered_at_f2,
            MAX(CASE WHEN ws.zone = 'F2' THEN ws.time END) AS exited_at_f2,
            MIN(CASE WHEN ws.zone = 'F3' THEN ws.time END) AS entered_at_f3,
            MAX(CASE WHEN ws.zone = 'F3' THEN ws.time END) AS exited_at_f3,
            MIN(CASE WHEN ws.zone = 'F4' THEN ws.time END) AS entered_at_f4,
            MAX(CASE WHEN ws.zone = 'F4' THEN ws.time END) AS exited_at_f4,
            BOOL_OR(ws.alarm_exist) AS had_alarm,
            MAX(fzd.slab) AS slab,
            MAX(fzd.alloy_code) AS alloy_code,
            MAX(fzd.alloy_code_text) AS alloy_code_text,
            MAX(fzd.thickness) AS thickness
        FROM with_session ws
        JOIN plc.furnace_zone_data fzd
          ON fzd.sheet = ws.sheet AND fzd.melt = ws.melt AND fzd.part_no = ws.part_no 
         AND fzd.pack = ws.pack AND fzd.time = ws.time AND fzd.zone = ws.zone
        GROUP BY ws.sheet, ws.melt, ws.part_no, ws.pack, ws.pass_id
    ),
    zones_paths AS (
        SELECT sheet, melt, part_no, pack, pass_id,
            STRING_AGG(zone, '->' ORDER BY first_time) AS zones_path
        FROM (
            SELECT sheet, melt, part_no, pack, pass_id, zone, MIN(time) AS first_time
            FROM with_session
            GROUP BY sheet, melt, part_no, pack, pass_id, zone
        ) zone_order
        GROUP BY sheet, melt, part_no, pack, pass_id
    ),
    unprocessed AS (
        SELECT agg.*, zp.zones_path,
            ROW_NUMBER() OVER (PARTITION BY agg.sheet, agg.melt, agg.part_no, agg.pack ORDER BY agg.entered_at) AS rn
        FROM agg
        LEFT JOIN plc.heating_sessions hs
          ON hs.sheet = agg.sheet AND hs.melt = agg.melt AND hs.part_no = agg.part_no 
         AND hs.pack = agg.pack AND hs.entered_at between agg.entered_at - INTERVAL '5 minute' and agg.entered_at + INTERVAL '5 minute'
        LEFT JOIN zones_paths zp
          ON zp.sheet = agg.sheet AND zp.melt = agg.melt AND zp.part_no = agg.part_no 
         AND zp.pack = agg.pack AND zp.pass_id = agg.pass_id
        WHERE hs.id IS NULL
          AND agg.exited_at IS NOT NULL
          AND agg.total_minutes <= 50
          AND agg.exited_at < NOW() - INTERVAL '5 minutes'
    ),
    existing_max AS (
        SELECT sheet, melt, part_no, pack, 
               COALESCE(MAX(reheat_num), -1) AS max_reheat
        FROM plc.heating_sessions
        GROUP BY sheet, melt, part_no, pack
    )
    SELECT 
        up.sheet, up.melt, up.part_no, up.pack,
        up.entered_at, up.exited_at, up.total_minutes,
        up.f1_min, up.f2_min, up.f3_min, up.f4_min,
        up.entered_at_f1, up.exited_at_f1, up.entered_at_f2, up.exited_at_f2,
        up.entered_at_f3, up.exited_at_f3, up.entered_at_f4, up.exited_at_f4,
        up.had_alarm, up.slab, up.alloy_code, up.alloy_code_text, up.thickness,
        up.zones_path,
        COALESCE(em.max_reheat, -1) + up.rn AS reheat_num
    FROM unprocessed up
    LEFT JOIN existing_max em 
      ON em.sheet = up.sheet AND em.melt = up.melt 
     AND em.part_no = up.part_no AND em.pack = up.pack
    ORDER BY up.entered_at
    """;



   public const string SessionCount = """
    SELECT COUNT(*)
    FROM plc.heating_sessions
    WHERE (@From      IS NULL OR entered_at  >= @From)
      AND (@To        IS NULL OR entered_at  <= @To)
      AND (@Sheet     IS NULL OR sheet       = @Sheet)
      AND (@Slab      IS NULL OR slab        = @Slab)
      AND (@Melt      IS NULL OR melt        = @Melt)
      AND (@Part      IS NULL OR part_no     = @Part)
      AND (@Batch     IS NULL OR pack        = @Batch)
      AND (@AlloyCode IS NULL OR alloy_code_text ILIKE '%' || @AlloyCode || '%')
""";

public const string SessionList = """
    SELECT
        id AS Id, sheet AS Sheet, business_key AS BusinessKey,
        slab AS Slab, melt AS Melt, part_no AS PartNo, pack AS Pack, reheat_num AS ReheatNum,
        alloy_code AS AlloyCode, alloy_code_text AS AlloyCodeText, thickness AS Thickness,
        zones_path AS ZonesPath, entered_at AS EnteredAt, exited_at AS ExitedAt,
        total_min AS TotalMin, f1_min AS F1Min, f2_min AS F2Min, f3_min AS F3Min, f4_min AS F4Min,
        avg_z1_1 AS AvgZ1_1, avg_z1_2 AS AvgZ1_2, avg_z1_3 AS AvgZ1_3, avg_z1_4 AS AvgZ1_4,
        avg_z2_1 AS AvgZ2_1, avg_z2_2 AS AvgZ2_2, avg_z2_3 AS AvgZ2_3, avg_z2_4 AS AvgZ2_4,
        avg_z3_1 AS AvgZ3_1, avg_z3_2 AS AvgZ3_2, avg_z3_3 AS AvgZ3_3, avg_z3_4 AS AvgZ3_4,
        avg_z4_1 AS AvgZ4_1, avg_z4_2 AS AvgZ4_2, avg_z4_3 AS AvgZ4_3, avg_z4_4 AS AvgZ4_4,
        had_alarm AS HadAlarm, created_at AS CreatedAt
    FROM plc.heating_sessions
    WHERE (@From      IS NULL OR entered_at  >= @From)
      AND (@To        IS NULL OR entered_at  <= @To)
      AND (@Sheet     IS NULL OR sheet       = @Sheet)
      AND (@Slab      IS NULL OR slab        = @Slab)
      AND (@Melt      IS NULL OR melt        = @Melt)
      AND (@Part      IS NULL OR part_no     = @Part)
      AND (@Batch     IS NULL OR pack        = @Batch)
      AND (@AlloyCode IS NULL OR alloy_code_text ILIKE '%' || @AlloyCode || '%')
    ORDER BY entered_at DESC
    LIMIT @PageSize OFFSET @Offset
""";

    public const string SessionsBySheetKey = """
    SELECT
        id, sheet, slab, melt, part_no, pack, reheat_num, business_key,
        alloy_code, alloy_code_text, thickness, zones_path,
        entered_at, exited_at, total_min,
        f1_min, f2_min, f3_min, f4_min,
        avg_z1_1, avg_z1_2, avg_z1_3, avg_z1_4,
        avg_z2_1, avg_z2_2, avg_z2_3, avg_z2_4,
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
SELECT
    id AS Id, sheet AS Sheet, slab AS Slab, melt AS Melt,
    part_no AS PartNo, pack AS Pack, reheat_num AS ReheatNum,
    business_key AS BusinessKey, alloy_code AS AlloyCode,
    alloy_code_text AS AlloyCodeText, thickness AS Thickness,
    zones_path AS ZonesPath, entered_at AS EnteredAt,
    exited_at AS ExitedAt, total_min AS TotalMin,
    f1_min AS F1Min, f2_min AS F2Min, f3_min AS F3Min, f4_min AS F4Min,
    avg_z1_1 AS AvgZ1_1, avg_z1_2 AS AvgZ1_2, avg_z1_3 AS AvgZ1_3, avg_z1_4 AS AvgZ1_4,
    avg_z2_1 AS AvgZ2_1, avg_z2_2 AS AvgZ2_2, avg_z2_3 AS AvgZ2_3, avg_z2_4 AS AvgZ2_4,
    avg_z3_1 AS AvgZ3_1, avg_z3_2 AS AvgZ3_2, avg_z3_3 AS AvgZ3_3, avg_z3_4 AS AvgZ3_4,
    avg_z4_1 AS AvgZ4_1, avg_z4_2 AS AvgZ4_2, avg_z4_3 AS AvgZ4_3, avg_z4_4 AS AvgZ4_4,
    had_alarm AS HadAlarm, created_at AS CreatedAt,
    temps_z1 AS TempsZ1, temps_z2 AS TempsZ2, temps_z3 AS TempsZ3, temps_z4 AS TempsZ4, temps_time AS TempsTime
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
        avg_z1_1, avg_z1_2, avg_z1_3, avg_z1_4,
        avg_z2_1, avg_z2_2, avg_z2_3, avg_z2_4,
        avg_z3_1, avg_z3_2, avg_z3_3, avg_z3_4,
        avg_z4_1, avg_z4_2, avg_z4_3, avg_z4_4,
        temps_z1, temps_z2, temps_z3, temps_z4, temps_time,
        had_alarm
    ) VALUES (
        @Sheet, @Slab, @Melt, @PartNo, @Pack, @ReheatNum,
        @AlloyCode, @AlloyCodeText,
        @Thickness, @ZonesPath, @EnteredAt, @ExitedAt, @TotalMin,
        @F1Min, @F2Min, @F3Min, @F4Min,
        @AvgZ1_1, @AvgZ1_2, @AvgZ1_3, @AvgZ1_4,
        @AvgZ2_1, @AvgZ2_2, @AvgZ2_3, @AvgZ2_4,
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
        avg_z1_3 = EXCLUDED.avg_z1_3, avg_z1_4 = EXCLUDED.avg_z1_4,
        avg_z2_1 = EXCLUDED.avg_z2_1, avg_z2_2 = EXCLUDED.avg_z2_2,
        avg_z2_3 = EXCLUDED.avg_z2_3, avg_z2_4 = EXCLUDED.avg_z2_4,
        avg_z3_1 = EXCLUDED.avg_z3_1, avg_z3_2 = EXCLUDED.avg_z3_2,
        avg_z3_3 = EXCLUDED.avg_z3_3, avg_z3_4 = EXCLUDED.avg_z3_4,
        avg_z4_1 = EXCLUDED.avg_z4_1, avg_z4_2 = EXCLUDED.avg_z4_2,
        avg_z4_3 = EXCLUDED.avg_z4_3, avg_z4_4 = EXCLUDED.avg_z4_4,
        temps_z1 = EXCLUDED.temps_z1, temps_z2 = EXCLUDED.temps_z2,
        temps_z3 = EXCLUDED.temps_z3, temps_z4 = EXCLUDED.temps_z4,
        temps_time = EXCLUDED.temps_time
    """;





    // -----------------------------------------------------------------------
    // quenching_sessions
    // -----------------------------------------------------------------------

    public const string FindCompletedQuenchingSheets = """
    WITH
    presence AS (
        SELECT sheet, melt, part_no, pack, time, alarm_exist,
            time - LAG(time) OVER (PARTITION BY sheet, melt, part_no, pack ORDER BY time) AS gap
        FROM plc.furnace_zone_data
        WHERE zone = 'X1'
          AND zone_occup = TRUE
          AND sheet > 0 AND part_no > 0 AND pack > 0
          AND time > NOW() - INTERVAL '3 days'
    ),
    with_flag AS (
        SELECT *,
            CASE WHEN gap IS NULL OR gap > INTERVAL '30 minutes' THEN 1 ELSE 0 END AS is_new_session
        FROM presence
    ),
    with_session AS (
        SELECT *,
            SUM(is_new_session) OVER (
                PARTITION BY sheet, melt, part_no, pack 
                ORDER BY time ROWS UNBOUNDED PRECEDING
            ) - 1 AS pass_id
        FROM with_flag
    ),
    agg AS (
        SELECT
            ws.sheet, ws.melt, ws.part_no, ws.pack, ws.pass_id,
            MIN(ws.time) AS entered_at,
            MAX(ws.time) AS exited_at,
            EXTRACT(EPOCH FROM (MAX(ws.time) - MIN(ws.time))) AS total_sec,
            BOOL_OR(ws.alarm_exist) AS had_alarm
        FROM with_session ws
        GROUP BY ws.sheet, ws.melt, ws.part_no, ws.pack, ws.pass_id
    ),
    enriched AS (
        SELECT
            a.sheet, a.melt, a.part_no, a.pack, a.pass_id,
            a.entered_at, a.exited_at, a.total_sec, a.had_alarm,
            MAX(fzd.slab) AS slab,
            MAX(fzd.alloy_code) AS alloy_code,
            MAX(fzd.alloy_code_text) AS alloy_code_text,
            MAX(fzd.thickness) AS thickness
        FROM agg a
        JOIN plc.furnace_zone_data fzd
            ON fzd.sheet = a.sheet AND fzd.melt = a.melt AND fzd.part_no = a.part_no 
           AND fzd.pack = a.pack AND fzd.zone = 'X1' AND fzd.time = a.entered_at
        GROUP BY a.sheet, a.melt, a.part_no, a.pack, a.pass_id,
                 a.entered_at, a.exited_at, a.total_sec, a.had_alarm
    ),
    unprocessed AS (
        SELECT e.*,
            ROW_NUMBER() OVER (PARTITION BY e.sheet, e.melt, e.part_no, e.pack ORDER BY e.entered_at) AS rn
        FROM enriched e
        LEFT JOIN plc.quenching_sessions qs
            ON qs.sheet = e.sheet AND qs.melt = e.melt AND qs.part_no = e.part_no 
           AND qs.pack = e.pack AND qs.entered_at between e.entered_at - INTERVAL '5 MINUTES' AND e.entered_at + INTERVAL '5 MINUTES'
        WHERE qs.id IS NULL
          AND e.exited_at IS NOT NULL
          AND e.exited_at < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
    ),
    existing_max AS (
        SELECT sheet, melt, part_no, pack, 
               COALESCE(MAX(reheat_num), -1) AS max_reheat
        FROM plc.quenching_sessions
        GROUP BY sheet, melt, part_no, pack
    )
    SELECT 
        up.sheet, up.melt, up.part_no, up.pack,
        up.entered_at, up.exited_at, up.total_sec, up.had_alarm,
        up.slab, up.alloy_code, up.alloy_code_text, up.thickness,
        COALESCE(em.max_reheat, -1) + up.rn AS reheat_num
    FROM unprocessed up
    LEFT JOIN existing_max em 
      ON em.sheet = up.sheet AND em.melt = up.melt 
     AND em.part_no = up.part_no AND em.pack = up.pack
    ORDER BY up.entered_at
    """;

    public const string FindMissedQuenchingSheets = """
    WITH
    presence AS (
        SELECT sheet, melt, part_no, pack, time, alarm_exist,
            time - LAG(time) OVER (PARTITION BY sheet, melt, part_no, pack ORDER BY time) AS gap
        FROM plc.furnace_zone_data
        WHERE zone = 'X1'
          AND zone_occup = TRUE
          AND sheet > 0 AND part_no > 0 AND pack > 0
          AND time > NOW() - (@DaysBack || ' days')::INTERVAL
    ),
    with_flag AS (
        SELECT *,
            CASE WHEN gap IS NULL OR gap > INTERVAL '30 minutes' THEN 1 ELSE 0 END AS is_new_session
        FROM presence
    ),
    with_session AS (
        SELECT *,
            SUM(is_new_session) OVER (
                PARTITION BY sheet, melt, part_no, pack 
                ORDER BY time ROWS UNBOUNDED PRECEDING
            ) - 1 AS pass_id
        FROM with_flag
    ),
    agg AS (
        SELECT
            ws.sheet, ws.melt, ws.part_no, ws.pack, ws.pass_id,
            MIN(ws.time) AS entered_at,
            MAX(ws.time) AS exited_at,
            EXTRACT(EPOCH FROM (MAX(ws.time) - MIN(ws.time))) AS total_sec,
            BOOL_OR(ws.alarm_exist) AS had_alarm
        FROM with_session ws
        GROUP BY ws.sheet, ws.melt, ws.part_no, ws.pack, ws.pass_id
    ),
    enriched AS (
        SELECT
            a.sheet, a.melt, a.part_no, a.pack, a.pass_id,
            a.entered_at, a.exited_at, a.total_sec, a.had_alarm,
            MAX(fzd.slab) AS slab,
            MAX(fzd.alloy_code) AS alloy_code,
            MAX(fzd.alloy_code_text) AS alloy_code_text,
            MAX(fzd.thickness) AS thickness
        FROM agg a
        JOIN plc.furnace_zone_data fzd
            ON fzd.sheet = a.sheet AND fzd.melt = a.melt AND fzd.part_no = a.part_no 
           AND fzd.pack = a.pack AND fzd.zone = 'X1' AND fzd.time = a.entered_at
        GROUP BY a.sheet, a.melt, a.part_no, a.pack, a.pass_id,
                 a.entered_at, a.exited_at, a.total_sec, a.had_alarm
    ),
    unprocessed AS (
        SELECT e.*,
            ROW_NUMBER() OVER (PARTITION BY e.sheet, e.melt, e.part_no, e.pack ORDER BY e.entered_at) AS rn
        FROM enriched e
        LEFT JOIN plc.quenching_sessions qs
            ON qs.sheet = e.sheet AND qs.melt = e.melt AND qs.part_no = e.part_no 
           AND qs.pack = e.pack AND qs.entered_at between e.entered_at - INTERVAL '5 MINUTES' AND e.entered_at + INTERVAL '5 MINUTES'
        WHERE qs.id IS NULL
          AND e.exited_at IS NOT NULL
          AND e.exited_at < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
    ),
    existing_max AS (
        SELECT sheet, melt, part_no, pack, 
               COALESCE(MAX(reheat_num), -1) AS max_reheat
        FROM plc.quenching_sessions
        GROUP BY sheet, melt, part_no, pack
    )
    SELECT 
        up.sheet, up.melt, up.part_no, up.pack,
        up.entered_at, up.exited_at, up.total_sec, up.had_alarm,
        up.slab, up.alloy_code, up.alloy_code_text, up.thickness,
        COALESCE(em.max_reheat, -1) + up.rn AS reheat_num
    FROM unprocessed up
    LEFT JOIN existing_max em 
      ON em.sheet = up.sheet AND em.melt = up.melt 
     AND em.part_no = up.part_no AND em.pack = up.pack
    ORDER BY up.entered_at
    """;

    public const string GetQuenchingArrays = """
SELECT
    -- unlock
    JSONB_AGG(valve_1x1_unlock  ORDER BY time) AS V1_U1, JSONB_AGG(valve_1x2_unlock  ORDER BY time) AS V1_U2,
    JSONB_AGG(valve_1x3_unlock  ORDER BY time) AS V1_U3, JSONB_AGG(valve_1x4_unlock  ORDER BY time) AS V1_U4,
    JSONB_AGG(valve_1x5_unlock  ORDER BY time) AS V1_U5, JSONB_AGG(valve_1x6_unlock  ORDER BY time) AS V1_U6,
    JSONB_AGG(valve_1x7_unlock  ORDER BY time) AS V1_U7, JSONB_AGG(valve_1x8_unlock  ORDER BY time) AS V1_U8,
    JSONB_AGG(valve_1x9_unlock  ORDER BY time) AS V1_U9, JSONB_AGG(valve_1x10_unlock ORDER BY time) AS V1_U10,
    JSONB_AGG(valve_2x1_unlock  ORDER BY time) AS V2_U1, JSONB_AGG(valve_2x2_unlock  ORDER BY time) AS V2_U2,
    JSONB_AGG(valve_2x3_unlock  ORDER BY time) AS V2_U3, JSONB_AGG(valve_2x4_unlock  ORDER BY time) AS V2_U4,
    JSONB_AGG(valve_2x5_unlock  ORDER BY time) AS V2_U5, JSONB_AGG(valve_2x6_unlock  ORDER BY time) AS V2_U6,
    JSONB_AGG(valve_2x7_unlock  ORDER BY time) AS V2_U7, JSONB_AGG(valve_2x8_unlock  ORDER BY time) AS V2_U8,
    JSONB_AGG(valve_2x9_unlock  ORDER BY time) AS V2_U9, JSONB_AGG(valve_2x10_unlock ORDER BY time) AS V2_U10,
    -- mnat
    JSONB_AGG(valve_1x1_mnat    ORDER BY time) AS V1_M1, JSONB_AGG(valve_1x2_mnat    ORDER BY time) AS V1_M2,
    JSONB_AGG(valve_1x3_mnat    ORDER BY time) AS V1_M3, JSONB_AGG(valve_1x4_mnat    ORDER BY time) AS V1_M4,
    JSONB_AGG(valve_1x5_mnat    ORDER BY time) AS V1_M5, JSONB_AGG(valve_1x6_mnat    ORDER BY time) AS V1_M6,
    JSONB_AGG(valve_1x7_mnat    ORDER BY time) AS V1_M7, JSONB_AGG(valve_1x8_mnat    ORDER BY time) AS V1_M8,
    JSONB_AGG(valve_1x9_mnat    ORDER BY time) AS V1_M9, JSONB_AGG(valve_1x10_mnat   ORDER BY time) AS V1_M10,
    JSONB_AGG(valve_2x1_mnat    ORDER BY time) AS V2_M1, JSONB_AGG(valve_2x2_mnat    ORDER BY time) AS V2_M2,
    JSONB_AGG(valve_2x3_mnat    ORDER BY time) AS V2_M3, JSONB_AGG(valve_2x4_mnat    ORDER BY time) AS V2_M4,
    JSONB_AGG(valve_2x5_mnat    ORDER BY time) AS V2_M5, JSONB_AGG(valve_2x6_mnat    ORDER BY time) AS V2_M6,
    JSONB_AGG(valve_2x7_mnat    ORDER BY time) AS V2_M7, JSONB_AGG(valve_2x8_mnat    ORDER BY time) AS V2_M8,
    JSONB_AGG(valve_2x9_mnat    ORDER BY time) AS V2_M9, JSONB_AGG(valve_2x10_mnat   ORDER BY time) AS V2_M10,
    -- давления
    JSONB_AGG(press9              ORDER BY time) AS Press9,
    JSONB_AGG(press10             ORDER BY time) AS Press10,
    JSONB_AGG(press11             ORDER BY time) AS Press11,
    JSONB_AGG(press12             ORDER BY time) AS Press12,
    JSONB_AGG(press_top_lamin1    ORDER BY time) AS PressTopLamin1,
    JSONB_AGG(press_bot_lamin1    ORDER BY time) AS PressBotLamin1,
    JSONB_AGG(press_top_lamin2    ORDER BY time) AS PressTopLamin2,
    JSONB_AGG(press_bot_lamin2    ORDER BY time) AS PressBotLamin2,
    JSONB_AGG(press_top_zak       ORDER BY time) AS PressTopZak,
    JSONB_AGG(press_bot_zak       ORDER BY time) AS PressBotZak,
    -- уровни и воздух
    JSONB_AGG(level_haccum        ORDER BY time) AS LevelHaccum,
    JSONB_AGG(level_tank          ORDER BY time) AS LevelTank,
    JSONB_AGG(air_prs             ORDER BY time) AS AirPrs,
    -- температуры
    JSONB_AGG(temp_grad           ORDER BY time) AS TempGrad,
    JSONB_AGG(temp_top_lam1       ORDER BY time) AS TempTopLam1,
    JSONB_AGG(temp_bot_lam1       ORDER BY time) AS TempBotLam1,
    JSONB_AGG(temp_top_lam2       ORDER BY time) AS TempTopLam2,
    JSONB_AGG(temp_bot_lam2       ORDER BY time) AS TempBotLam2,
    JSONB_AGG(temp_haccum         ORDER BY time) AS TempHaccum,
    -- позиции
    JSONB_AGG(valve_x1_up_pos_ref    ORDER BY time) AS ValveX1UpPosRef,
    JSONB_AGG(valve_x1_up_pos_fbk    ORDER BY time) AS ValveX1UpPosFbk,
    JSONB_AGG(valve_x1_down_pos_ref  ORDER BY time) AS ValveX1DownPosRef,
    JSONB_AGG(valve_x1_down_pos_fbk  ORDER BY time) AS ValveX1DownPosFbk,
    JSONB_AGG(valve_x2_1_up_pos_ref   ORDER BY time) AS ValveX2_1UpPosRef,
    JSONB_AGG(valve_x2_1_up_pos_fbk   ORDER BY time) AS ValveX2_1UpPosFbk,
    JSONB_AGG(valve_x2_1_down_pos_ref ORDER BY time) AS ValveX2_1DownPosRef,
    JSONB_AGG(valve_x2_1_down_pos_fbk ORDER BY time) AS ValveX2_1DownPosFbk,
    JSONB_AGG(valve_x2_2_up_pos_ref   ORDER BY time) AS ValveX2_2UpPosRef,
    JSONB_AGG(valve_x2_2_up_pos_fbk   ORDER BY time) AS ValveX2_2UpPosFbk,
    JSONB_AGG(valve_x2_2_down_pos_ref ORDER BY time) AS ValveX2_2DownPosRef,
    JSONB_AGG(valve_x2_2_down_pos_fbk ORDER BY time) AS ValveX2_2DownPosFbk,
    JSONB_AGG(time                ORDER BY time) AS Times
FROM plc.quenching_data
WHERE time BETWEEN @From AND @To
""";

    public const string UpsertQuenchingSession = """
INSERT INTO plc.quenching_sessions (
    sheet, slab, melt, part_no, pack, reheat_num,
    alloy_code, alloy_code_text, thickness,
    entered_at, exited_at, total_sec,
    valves_1_unlock, valves_2_unlock,
    valves_1_mnat, valves_2_mnat,
    press9, press10, press11, press12,
    press_top_lamin1, press_bot_lamin1, press_top_lamin2, press_bot_lamin2,
    press_top_zak, press_bot_zak,
    level_haccum, level_tank, air_prs,
    temp_grad, temp_top_lam1, temp_bot_lam1, temp_top_lam2, temp_bot_lam2, temp_haccum,
    valve_x1_up_pos_ref, valve_x1_up_pos_fbk, valve_x1_down_pos_ref, valve_x1_down_pos_fbk,
    valve_x2_1_up_pos_ref, valve_x2_1_up_pos_fbk, valve_x2_1_down_pos_ref, valve_x2_1_down_pos_fbk,
    valve_x2_2_up_pos_ref, valve_x2_2_up_pos_fbk, valve_x2_2_down_pos_ref, valve_x2_2_down_pos_fbk,
    had_alarm
) VALUES (
    @Sheet, @Slab, @Melt, @PartNo, @Pack, @ReheatNum,
    @AlloyCode, @AlloyCodeText, @Thickness,
    @EnteredAt, @ExitedAt, @TotalSec,
    @Valves1Unlock, @Valves2Unlock,
    @Valves1Mnat::jsonb, @Valves2Mnat::jsonb,
    @Press9, @Press10, @Press11, @Press12,
    @PressTopLamin1, @PressBotLamin1, @PressTopLamin2, @PressBotLamin2,
    @PressTopZak, @PressBotZak,
    @LevelHaccum, @LevelTank, @AirPrs,
    @TempGrad, @TempTopLam1, @TempBotLam1, @TempTopLam2, @TempBotLam2, @TempHaccum,
    @ValveX1UpPosRef, @ValveX1UpPosFbk, @ValveX1DownPosRef, @ValveX1DownPosFbk,
    @ValveX2_1UpPosRef, @ValveX2_1UpPosFbk, @ValveX2_1DownPosRef, @ValveX2_1DownPosFbk,
    @ValveX2_2UpPosRef, @ValveX2_2UpPosFbk, @ValveX2_2DownPosRef, @ValveX2_2DownPosFbk,
    @HadAlarm
)
ON CONFLICT (business_key) DO UPDATE SET
    exited_at          = EXCLUDED.exited_at,
    total_sec          = EXCLUDED.total_sec,
    valves_1_unlock    = EXCLUDED.valves_1_unlock,
    valves_2_unlock    = EXCLUDED.valves_2_unlock,
    valves_1_mnat      = EXCLUDED.valves_1_mnat,
    valves_2_mnat      = EXCLUDED.valves_2_mnat,
    press9 = EXCLUDED.press9, press10 = EXCLUDED.press10,
    press11 = EXCLUDED.press11, press12 = EXCLUDED.press12,
    press_top_lamin1 = EXCLUDED.press_top_lamin1, press_bot_lamin1 = EXCLUDED.press_bot_lamin1,
    press_top_lamin2 = EXCLUDED.press_top_lamin2, press_bot_lamin2 = EXCLUDED.press_bot_lamin2,
    press_top_zak = EXCLUDED.press_top_zak, press_bot_zak = EXCLUDED.press_bot_zak,
    level_haccum = EXCLUDED.level_haccum, level_tank = EXCLUDED.level_tank,
    air_prs = EXCLUDED.air_prs,
    temp_grad = EXCLUDED.temp_grad,
    temp_top_lam1 = EXCLUDED.temp_top_lam1, temp_bot_lam1 = EXCLUDED.temp_bot_lam1,
    temp_top_lam2 = EXCLUDED.temp_top_lam2, temp_bot_lam2 = EXCLUDED.temp_bot_lam2,
    temp_haccum = EXCLUDED.temp_haccum,
    valve_x1_up_pos_ref = EXCLUDED.valve_x1_up_pos_ref,
    valve_x1_up_pos_fbk = EXCLUDED.valve_x1_up_pos_fbk,
    valve_x1_down_pos_ref = EXCLUDED.valve_x1_down_pos_ref,
    valve_x1_down_pos_fbk = EXCLUDED.valve_x1_down_pos_fbk,
    valve_x2_1_up_pos_ref = EXCLUDED.valve_x2_1_up_pos_ref,
    valve_x2_1_up_pos_fbk = EXCLUDED.valve_x2_1_up_pos_fbk,
    valve_x2_1_down_pos_ref = EXCLUDED.valve_x2_1_down_pos_ref,
    valve_x2_1_down_pos_fbk = EXCLUDED.valve_x2_1_down_pos_fbk,
    valve_x2_2_up_pos_ref = EXCLUDED.valve_x2_2_up_pos_ref,
    valve_x2_2_up_pos_fbk = EXCLUDED.valve_x2_2_up_pos_fbk,
    valve_x2_2_down_pos_ref = EXCLUDED.valve_x2_2_down_pos_ref,
    valve_x2_2_down_pos_fbk = EXCLUDED.valve_x2_2_down_pos_fbk,
    had_alarm          = EXCLUDED.had_alarm
""";


    // -----------------------------------------------------------------------
    // quenching_sessions
    // -----------------------------------------------------------------------

    public const string QuenchingSessionCount = """
    SELECT COUNT(*)
    FROM plc.quenching_sessions
    WHERE (@From      IS NULL OR entered_at >= @From)
      AND (@To        IS NULL OR entered_at <= @To)
      AND (@Slab      IS NULL OR slab       = @Slab)
      AND (@Melt      IS NULL OR melt       = @Melt)
      AND (@AlloyCode IS NULL OR alloy_code = @AlloyCode)
    """;

    public const string QuenchingSessionList = """
SELECT
    id AS Id, sheet AS Sheet, business_key AS BusinessKey,
    slab AS Slab, melt AS Melt, part_no AS PartNo, pack AS Pack, reheat_num AS ReheatNum,
    alloy_code AS AlloyCode, alloy_code_text AS AlloyCodeText, thickness AS Thickness,
    entered_at AS EnteredAt, exited_at AS ExitedAt, total_sec AS TotalSec,
    valves_1_unlock AS Valves1Unlock, valves_2_unlock AS Valves2Unlock,
    valves_1_mnat AS Valves1Mnat, valves_2_mnat AS Valves2Mnat,
    press9 AS Press9, press10 AS Press10, press11 AS Press11, press12 AS Press12,
    press_top_lamin1 AS PressTopLamin1, press_bot_lamin1 AS PressBotLamin1,
    press_top_lamin2 AS PressTopLamin2, press_bot_lamin2 AS PressBotLamin2,
    press_top_zak AS PressTopZak, press_bot_zak AS PressBotZak,
    level_haccum AS LevelHaccum, level_tank AS LevelTank, air_prs AS AirPrs,
    temp_grad AS TempGrad, temp_top_lam1 AS TempTopLam1, temp_bot_lam1 AS TempBotLam1,
    temp_top_lam2 AS TempTopLam2, temp_bot_lam2 AS TempBotLam2, temp_haccum AS TempHaccum,
    valve_x1_up_pos_ref AS ValveX1UpPosRef, valve_x1_up_pos_fbk AS ValveX1UpPosFbk,
    valve_x1_down_pos_ref AS ValveX1DownPosRef, valve_x1_down_pos_fbk AS ValveX1DownPosFbk,
    valve_x2_1_up_pos_ref AS ValveX2_1UpPosRef, valve_x2_1_up_pos_fbk AS ValveX2_1UpPosFbk,
    valve_x2_1_down_pos_ref AS ValveX2_1DownPosRef, valve_x2_1_down_pos_fbk AS ValveX2_1DownPosFbk,
    valve_x2_2_up_pos_ref AS ValveX2_2UpPosRef, valve_x2_2_up_pos_fbk AS ValveX2_2UpPosFbk,
    valve_x2_2_down_pos_ref AS ValveX2_2DownPosRef, valve_x2_2_down_pos_fbk AS ValveX2_2DownPosFbk,
    had_alarm AS HadAlarm, created_at AS CreatedAt
FROM plc.quenching_sessions
WHERE (@From IS NULL OR entered_at >= @From)
  AND (@To IS NULL OR entered_at <= @To)
  AND (@Slab IS NULL OR slab = @Slab)
  AND (@Melt IS NULL OR melt = @Melt)
  AND (@AlloyCode IS NULL OR alloy_code = @AlloyCode)
ORDER BY entered_at DESC
LIMIT @PageSize OFFSET @Offset
""";

    public const string QuenchingSessionByKey = """
SELECT
    id AS Id, sheet AS Sheet, business_key AS BusinessKey,
    slab AS Slab, melt AS Melt, part_no AS PartNo, pack AS Pack, reheat_num AS ReheatNum,
    alloy_code AS AlloyCode, alloy_code_text AS AlloyCodeText, thickness AS Thickness,
    entered_at AS EnteredAt, exited_at AS ExitedAt, total_sec AS TotalSec,
    valves_1_unlock AS Valves1Unlock, valves_2_unlock AS Valves2Unlock,
    valves_1_mnat AS Valves1Mnat, valves_2_mnat AS Valves2Mnat,
    press9 AS Press9, press10 AS Press10, press11 AS Press11, press12 AS Press12,
    press_top_lamin1 AS PressTopLamin1, press_bot_lamin1 AS PressBotLamin1,
    press_top_lamin2 AS PressTopLamin2, press_bot_lamin2 AS PressBotLamin2,
    press_top_zak AS PressTopZak, press_bot_zak AS PressBotZak,
    level_haccum AS LevelHaccum, level_tank AS LevelTank, air_prs AS AirPrs,
    temp_grad AS TempGrad, temp_top_lam1 AS TempTopLam1, temp_bot_lam1 AS TempBotLam1,
    temp_top_lam2 AS TempTopLam2, temp_bot_lam2 AS TempBotLam2, temp_haccum AS TempHaccum,
    valve_x1_up_pos_ref AS ValveX1UpPosRef, valve_x1_up_pos_fbk AS ValveX1UpPosFbk,
    valve_x1_down_pos_ref AS ValveX1DownPosRef, valve_x1_down_pos_fbk AS ValveX1DownPosFbk,
    valve_x2_1_up_pos_ref AS ValveX2_1UpPosRef, valve_x2_1_up_pos_fbk AS ValveX2_1UpPosFbk,
    valve_x2_1_down_pos_ref AS ValveX2_1DownPosRef, valve_x2_1_down_pos_fbk AS ValveX2_1DownPosFbk,
    valve_x2_2_up_pos_ref AS ValveX2_2UpPosRef, valve_x2_2_up_pos_fbk AS ValveX2_2UpPosFbk,
    valve_x2_2_down_pos_ref AS ValveX2_2DownPosRef, valve_x2_2_down_pos_fbk AS ValveX2_2DownPosFbk,
    had_alarm AS HadAlarm, created_at AS CreatedAt
FROM plc.quenching_sessions
WHERE business_key = @Key
""";

    public const string QuenchingSessionsBySheet = """
SELECT
    id AS Id, sheet AS Sheet, business_key AS BusinessKey,
    slab AS Slab, melt AS Melt, part_no AS PartNo, pack AS Pack, reheat_num AS ReheatNum,
    alloy_code AS AlloyCode, alloy_code_text AS AlloyCodeText, thickness AS Thickness,
    entered_at AS EnteredAt, exited_at AS ExitedAt, total_sec AS TotalSec,
    valves_1_unlock AS Valves1Unlock, valves_2_unlock AS Valves2Unlock,
    valves_1_mnat AS Valves1Mnat, valves_2_mnat AS Valves2Mnat,
    press9 AS Press9, press10 AS Press10, press11 AS Press11, press12 AS Press12,
    press_top_lamin1 AS PressTopLamin1, press_bot_lamin1 AS PressBotLamin1,
    press_top_lamin2 AS PressTopLamin2, press_bot_lamin2 AS PressBotLamin2,
    press_top_zak AS PressTopZak, press_bot_zak AS PressBotZak,
    level_haccum AS LevelHaccum, level_tank AS LevelTank, air_prs AS AirPrs,
    temp_grad AS TempGrad, temp_top_lam1 AS TempTopLam1, temp_bot_lam1 AS TempBotLam1,
    temp_top_lam2 AS TempTopLam2, temp_bot_lam2 AS TempBotLam2, temp_haccum AS TempHaccum,
    valve_x1_up_pos_ref AS ValveX1UpPosRef, valve_x1_up_pos_fbk AS ValveX1UpPosFbk,
    valve_x1_down_pos_ref AS ValveX1DownPosRef, valve_x1_down_pos_fbk AS ValveX1DownPosFbk,
    valve_x2_1_up_pos_ref AS ValveX2_1UpPosRef, valve_x2_1_up_pos_fbk AS ValveX2_1UpPosFbk,
    valve_x2_1_down_pos_ref AS ValveX2_1DownPosRef, valve_x2_1_down_pos_fbk AS ValveX2_1DownPosFbk,
    valve_x2_2_up_pos_ref AS ValveX2_2UpPosRef, valve_x2_2_up_pos_fbk AS ValveX2_2UpPosFbk,
    valve_x2_2_down_pos_ref AS ValveX2_2DownPosRef, valve_x2_2_down_pos_fbk AS ValveX2_2DownPosFbk,
    had_alarm AS HadAlarm, created_at AS CreatedAt
FROM plc.quenching_sessions
WHERE sheet = @Sheet
ORDER BY entered_at DESC
""";

    // -----------------------------------------------------------------------
    // tempering_sessions
    // -----------------------------------------------------------------------
    public const string UpsertTemperingSessions = """
WITH params AS (
    SELECT
        30 AS min_duration_min,
        (@GracePeriodMinutes || ' minutes')::INTERVAL AS grace_interval
),
temp_data AS (
    SELECT
        furnace_no, time, temp_act, temp_ref,
        point_ref_1, point_time_1, point_dtime_2, time_proc_set, proc_fault,
        proc_run, proc_end, act_time_total,
        cassette_no, cass_day, cass_month,
        CASE WHEN cass_year  < 100 THEN 2000 + cass_year ELSE cass_year END AS cass_year,
        cass_hour,
        cass1_no, cass1_day, cass1_month,
        CASE WHEN cass1_year  < 100 THEN 2000 + cass1_year ELSE cass1_year END AS cass1_year,
        cass1_hour,
        cass2_no, cass2_day, cass2_month,
        CASE WHEN cass2_year  < 100 THEN 2000 + cass2_year ELSE cass2_year END AS cass2_year,
        cass2_hour
    FROM plc.tempering_data
    WHERE time  > NOW() - (@LookbackDays || ' days')::INTERVAL
      AND temp_act IS NOT NULL
      AND furnace_no IN (1,2,3,4)
),
state_raw AS (
    SELECT *,
    CASE
        -- 1: ЦИКЛ АКТИВЕН (нагрев или выдержка)
        WHEN proc_run = TRUE AND COALESCE(time_proc_set, 0) > 0 THEN 1
        -- 0: ЦИКЛ ЗАВЕРШЁН ИЛИ СБРОШЕН
        WHEN proc_end = TRUE
             OR (COALESCE(proc_run, FALSE) = FALSE
                 AND COALESCE(time_proc_set, 0) = 0
                 AND COALESCE(act_time_total, 0) = 0) THEN 0
        ELSE NULL
    END AS raw_state
    FROM temp_data
),
state_filled AS MATERIALIZED (
    SELECT *,
    COALESCE(
        raw_state,
        FIRST_VALUE(raw_state) OVER (
            PARTITION BY furnace_no, state_group
            ORDER BY time
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )
    ) AS state
    FROM (
        SELECT *,
        COUNT(raw_state) OVER (
            PARTITION BY furnace_no
            ORDER BY time
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS state_group
        FROM state_raw
    ) sub
),
transitions AS (
    SELECT *,
    CASE WHEN state = 1
              AND LAG(state, 1, 0) OVER (PARTITION BY furnace_no ORDER BY time) = 0
         THEN 1 ELSE 0
    END AS session_start
    FROM state_filled
),
session_ids AS MATERIALIZED (
    SELECT *,
    SUM(session_start) OVER (
        PARTITION BY furnace_no
        ORDER BY time
        ROWS UNBOUNDED PRECEDING
    ) AS session_id
    FROM transitions
),
session_bounds AS (
    SELECT
        furnace_no, session_id,
        MIN(time) AS started_at,
        MAX(time) AS last_active_at
    FROM session_ids
    WHERE state = 1 AND session_id > 0
    GROUP BY furnace_no, session_id
),
session_end_times AS (
    SELECT DISTINCT ON (si.furnace_no, si.session_id)
        si.furnace_no,
        si.session_id,
        si.time AS ended_at
    FROM session_ids si
    JOIN session_bounds sb USING (furnace_no, session_id)
    WHERE si.state = 0
      AND si.time  > sb.last_active_at
    ORDER BY si.furnace_no, si.session_id, si.time
),
session_with_end AS (
    SELECT
        sb.*,
        COALESCE(et.ended_at, sb.last_active_at) AS ended_at
    FROM session_bounds sb
    LEFT JOIN session_end_times et USING (furnace_no, session_id)
),
agg AS (
    SELECT
        si.furnace_no,
        si.session_id,
        sw.started_at,
        sw.ended_at,
        EXTRACT(EPOCH FROM (sw.ended_at - sw.started_at)) / 60 AS duration_min,
        MIN(si.temp_act)       AS temp_min,
        MAX(si.temp_act)       AS temp_max,
        AVG(si.temp_act)       AS temp_avg,
        MAX(si.temp_ref)       AS temp_ref,
        MAX(si.point_ref_1)    AS target_temp,
        MAX(si.time_proc_set)  AS target_time,
        BOOL_OR(si.proc_fault) AS had_fault,
        MAX(si.point_ref_1)    AS point_ref_1,
        MAX(si.point_time_1)   AS point_time_1,
        MAX(si.point_dtime_2)  AS point_dtime_2,
        (ARRAY_AGG(si.cassette_no ORDER BY si.time DESC) FILTER (WHERE si.cassette_no  > 0))[1] AS cassette_no,
        (ARRAY_AGG(si.cass_day    ORDER BY si.time DESC) FILTER (WHERE si.cass_day     > 0))[1] AS cass_day,
        (ARRAY_AGG(si.cass_month  ORDER BY si.time DESC) FILTER (WHERE si.cass_month   > 0))[1] AS cass_month,
        (ARRAY_AGG(si.cass_year   ORDER BY si.time DESC) FILTER (WHERE si.cass_year    > 0))[1] AS cass_year,
        (ARRAY_AGG(si.cass_hour   ORDER BY si.time DESC) FILTER (WHERE si.cass_hour    > 0))[1] AS cass_hour,
        (ARRAY_AGG(si.cass1_no    ORDER BY si.time DESC) FILTER (WHERE si.cass1_no     > 0))[1] AS cass1_no,
        (ARRAY_AGG(si.cass1_day   ORDER BY si.time DESC) FILTER (WHERE si.cass1_day    > 0))[1] AS cass1_day,
        (ARRAY_AGG(si.cass1_month ORDER BY si.time DESC) FILTER (WHERE si.cass1_month  > 0))[1] AS cass1_month,
        (ARRAY_AGG(si.cass1_year  ORDER BY si.time DESC) FILTER (WHERE si.cass1_year   > 0))[1] AS cass1_year,
        (ARRAY_AGG(si.cass1_hour  ORDER BY si.time DESC) FILTER (WHERE si.cass1_hour   > 0))[1] AS cass1_hour,
        (ARRAY_AGG(si.cass2_no    ORDER BY si.time DESC) FILTER (WHERE si.cass2_no     > 0))[1] AS cass2_no,
        (ARRAY_AGG(si.cass2_day   ORDER BY si.time DESC) FILTER (WHERE si.cass2_day    > 0))[1] AS cass2_day,
        (ARRAY_AGG(si.cass2_month ORDER BY si.time DESC) FILTER (WHERE si.cass2_month  > 0))[1] AS cass2_month,
        (ARRAY_AGG(si.cass2_year  ORDER BY si.time DESC) FILTER (WHERE si.cass2_year   > 0))[1] AS cass2_year,
        (ARRAY_AGG(si.cass2_hour  ORDER BY si.time DESC) FILTER (WHERE si.cass2_hour   > 0))[1] AS cass2_hour
    FROM session_ids si
    JOIN session_with_end sw USING (furnace_no, session_id)
    WHERE si.state = 1 AND si.session_id > 0
    GROUP BY si.furnace_no, si.session_id, sw.started_at, sw.ended_at
)
INSERT INTO plc.tempering_sessions (
    furnace_no, started_at, ended_at, duration_min,
    temp_min, temp_max, temp_avg, temp_ref,
    target_temp, target_time, point_ref_1, point_time_1, point_dtime_2,
    had_fault,
    cassette_no, cass_day, cass_month, cass_year, cass_hour,
    cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
    cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour
)
SELECT
    furnace_no, started_at, ended_at, duration_min,
    temp_min, temp_max, temp_avg, temp_ref,
    target_temp, target_time, point_ref_1, point_time_1, point_dtime_2,
    had_fault,
    cassette_no, cass_day, cass_month, cass_year, cass_hour,
    cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
    cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour
FROM agg, params
WHERE duration_min >= params.min_duration_min
  AND ended_at     < NOW() - params.grace_interval
  -- Защита от пересечения с уже существующими сессиями
  AND NOT EXISTS (
      SELECT 1 FROM plc.tempering_sessions ts
      WHERE ts.furnace_no = agg.furnace_no
        AND ts.started_at < agg.ended_at
        AND COALESCE(ts.ended_at, 'infinity'::timestamptz) > agg.started_at
  );
""";

    // -----------------------------------------------------------------------
    // tempering_sessions (чтение для отчёта)
    // -----------------------------------------------------------------------
    public const string GetTemperingSessions = """
SELECT
    id AS Id,
    furnace_no AS FurnaceNo,
    started_at AS StartedAt,
    ended_at AS EndedAt,
    duration_min AS DurationMin,
    temp_min AS TempMin,
    temp_max AS TempMax,
    temp_avg AS TempAvg,
    temp_ref AS TempRef,
    target_temp AS TargetTemp,
    target_time AS TargetTime,
    point_ref_1 AS PointRef1,
    point_time_1 AS PointTime1,
    point_dtime_2 AS PointDtime2,
    had_fault AS HadFault,
    cassette_no AS CassetteNo,
    cass_day AS CassDay,
    cass_month AS CassMonth,
    cass_year AS CassYear,
    cass_hour AS CassHour,
    cass1_no AS Cass1No,
    cass1_day AS Cass1Day,
    cass1_month AS Cass1Month,
    cass1_year AS Cass1Year,
    cass1_hour AS Cass1Hour,
    cass2_no AS Cass2No,
    cass2_day AS Cass2Day,
    cass2_month AS Cass2Month,
    cass2_year AS Cass2Year,
    cass2_hour AS Cass2Hour
FROM plc.tempering_sessions
WHERE (@FurnaceNo IS NULL OR furnace_no = @FurnaceNo)
  AND (@From IS NULL OR started_at >= @From)
  AND (@To IS NULL OR started_at <= @To)
ORDER BY started_at DESC
LIMIT @PageSize OFFSET @Offset
""";

    public const string GetTemperingSessionsCount = """
SELECT COUNT(*)
FROM plc.tempering_sessions
WHERE (@FurnaceNo IS NULL OR furnace_no = @FurnaceNo)
  AND (@From IS NULL OR started_at >= @From)
  AND (@To IS NULL OR started_at <= @To)
""";

    public const string GetTemperingSessionDetails = """
SELECT
    time AS Time,
    temp_act AS TempAct,
    temp_ref AS TempRef,
    t1 AS T1,
    t2 AS T2,
    act_time_total AS ActTimeTotal,
    time_proc_set AS TimeProcSet
FROM plc.tempering_data
WHERE furnace_no = @FurnaceNo
  AND time BETWEEN @StartedAt AND @EndedAt
ORDER BY time
""";

    // -----------------------------------------------------------------------
    // tempering_auto_completion
    // -----------------------------------------------------------------------
    public const string FindCompletedTemperingFurnaces = """
    WITH latest_data AS (
        SELECT DISTINCT ON (furnace_no)
            furnace_no, proc_end, time
        FROM plc.tempering_data
        ORDER BY furnace_no, time DESC
    )
    SELECT 
        ld.furnace_no AS FurnaceNo,
        ld.proc_end AS ProcEnd,
        fcs.id AS SessionId,
        fcs.cassette_id AS CassetteId
    FROM latest_data ld
    INNER JOIN mes.furnace_cassette_sessions fcs 
        ON fcs.furnace_number = ld.furnace_no 
        AND fcs.unloaded_at IS NULL
    WHERE ld.proc_end = TRUE
    """;

    public const string UpdateTemperingSessionAsCompleted = """
    UPDATE mes.furnace_cassette_sessions 
    SET unloaded_at = @UnloadedAt, 
        completed_by_plc = TRUE, 
        unloaded_by = 'PLC_AUTO'
    WHERE id = @SessionId
    RETURNING cassette_id
    """;

    public const string UpdateCassetteStatusToTemperingCompleted = """
    UPDATE mes.cassettes 
    SET status = 'Отпуск завершён'
    WHERE cassette_id = @CassetteId 
      AND status = 'Отправлена в печь'
    """;

    public const string UpdateSheetsStatusToTemperingCompleted = """
    UPDATE mes.input_data 
    SET status = 'Отпуск пройден'
    WHERE mat_id IN (
        SELECT scl.mat_id 
        FROM mes.sheet_cassette_links scl
        WHERE scl.cassette_id = @CassetteId
    ) 
    AND status = 'В печи отпуска'
    """;
}