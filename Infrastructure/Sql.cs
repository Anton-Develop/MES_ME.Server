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
    SELECT
        sheet, melt, part_no, pack, zone,
        time, alarm_exist,
        time - LAG(time) OVER (
            PARTITION BY sheet, melt, part_no, pack, zone
            ORDER BY time
        ) AS gap
    FROM plc.furnace_zone_data
    WHERE zone IN ('F1','F2','F3','F4')
      AND zone_occup = TRUE
      AND sheet > 0
      AND part_no > 0
      AND pack > 0
),
with_flag AS (
    SELECT *,
        CASE WHEN gap IS NULL OR gap > INTERVAL '30 minutes' THEN 1 ELSE 0 END AS is_new_session
    FROM presence
),
with_session AS (
    SELECT *,
        SUM(is_new_session) OVER (
            PARTITION BY sheet, melt, part_no, pack, zone
            ORDER BY time
            ROWS UNBOUNDED PRECEDING
        ) - 1 AS reheat_num
    FROM with_flag
),
agg AS (
    SELECT
        ws.sheet, ws.melt, ws.part_no, ws.pack,
        MIN(ws.reheat_num) AS reheat_num,
        MIN(ws.time) AS entered_at,
        MAX(ws.time) AS exited_at,
        EXTRACT(EPOCH FROM (MAX(ws.time) - MIN(ws.time)))/60 AS total_minutes,
        EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F1' THEN ws.time END) - 
                            MIN(CASE WHEN ws.zone = 'F1' THEN ws.time END)))/60 AS f1_min,
        EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F2' THEN ws.time END) - 
                            MIN(CASE WHEN ws.zone = 'F2' THEN ws.time END)))/60 AS f2_min,
        EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F3' THEN ws.time END) - 
                            MIN(CASE WHEN ws.zone = 'F3' THEN ws.time END)))/60 AS f3_min,
        EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone = 'F4' THEN ws.time END) - 
                            MIN(CASE WHEN ws.zone = 'F4' THEN ws.time END)))/60 AS f4_min,
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
        ON fzd.sheet = ws.sheet
        AND fzd.melt = ws.melt
        AND fzd.part_no = ws.part_no
        AND fzd.pack = ws.pack
        AND fzd.time = ws.time
        AND fzd.zone = ws.zone
    GROUP BY ws.sheet, ws.melt, ws.part_no, ws.pack
),
zones_paths AS (
    SELECT 
        sheet, melt, part_no, pack,
        STRING_AGG(zone, '->' ORDER BY first_time) AS zones_path
    FROM (
        SELECT 
            sheet, melt, part_no, pack, zone,
            MIN(time) AS first_time
        FROM with_session
        GROUP BY sheet, melt, part_no, pack, zone
    ) zone_order
    GROUP BY sheet, melt, part_no, pack
)
SELECT agg.*, zp.zones_path
FROM agg
LEFT JOIN zones_paths zp
    ON zp.sheet = agg.sheet
    AND zp.melt = agg.melt
    AND zp.part_no = agg.part_no
    AND zp.pack = agg.pack
LEFT JOIN plc.heating_sessions hs
    ON hs.sheet = agg.sheet
    AND hs.melt = agg.melt
    AND hs.part_no = agg.part_no
    AND hs.pack = agg.pack
    AND hs.reheat_num = agg.reheat_num
WHERE hs.id IS NULL
    AND agg.exited_at IS NOT NULL
    AND agg.exited_at < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
    AND agg.total_minutes <= 35
ORDER BY agg.entered_at
""";


    public const string FindMissedSheets = """
WITH presence AS (
    SELECT sheet, melt, part_no, pack, zone, time, alarm_exist,
           time - LAG(time) OVER (PARTITION BY sheet, melt, part_no, pack, zone ORDER BY time) AS gap
    FROM plc.furnace_zone_data
    WHERE zone IN ('F1','F2','F3','F4')
      AND zone_occup = TRUE
      AND sheet > 0 AND part_no > 0 AND pack > 0
      AND time > NOW() - (@DaysBack || ' days')::INTERVAL
),
with_flag AS (SELECT *, CASE WHEN gap IS NULL OR gap > INTERVAL '30 minutes' THEN 1 ELSE 0 END AS is_new_session FROM presence),
with_session AS (SELECT *, SUM(is_new_session) OVER (PARTITION BY sheet, melt, part_no, pack, zone ORDER BY time ROWS UNBOUNDED PRECEDING) - 1 AS reheat_num FROM with_flag),
agg AS (
    SELECT ws.sheet, ws.melt, ws.part_no, ws.pack, MIN(ws.reheat_num) AS reheat_num,
           MIN(ws.time) AS entered_at, MAX(ws.time) AS exited_at,
           EXTRACT(EPOCH FROM (MAX(ws.time) - MIN(ws.time)))/60 AS total_minutes,
           EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone='F1' THEN ws.time END) - MIN(CASE WHEN ws.zone='F1' THEN ws.time END)))/60 AS f1_min,
           EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone='F2' THEN ws.time END) - MIN(CASE WHEN ws.zone='F2' THEN ws.time END)))/60 AS f2_min,
           EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone='F3' THEN ws.time END) - MIN(CASE WHEN ws.zone='F3' THEN ws.time END)))/60 AS f3_min,
           EXTRACT(EPOCH FROM (MAX(CASE WHEN ws.zone='F4' THEN ws.time END) - MIN(CASE WHEN ws.zone='F4' THEN ws.time END)))/60 AS f4_min,
           MIN(CASE WHEN ws.zone='F1' THEN ws.time END) AS entered_at_f1,
           MAX(CASE WHEN ws.zone='F1' THEN ws.time END) AS exited_at_f1,
           MIN(CASE WHEN ws.zone='F2' THEN ws.time END) AS entered_at_f2,
           MAX(CASE WHEN ws.zone='F2' THEN ws.time END) AS exited_at_f2,
           MIN(CASE WHEN ws.zone='F3' THEN ws.time END) AS entered_at_f3,
           MAX(CASE WHEN ws.zone='F3' THEN ws.time END) AS exited_at_f3,
           MIN(CASE WHEN ws.zone='F4' THEN ws.time END) AS entered_at_f4,
           MAX(CASE WHEN ws.zone='F4' THEN ws.time END) AS exited_at_f4,
           BOOL_OR(ws.alarm_exist) AS had_alarm,
           MAX(fzd.slab) AS slab, MAX(fzd.alloy_code) AS alloy_code, MAX(fzd.alloy_code_text) AS alloy_code_text, MAX(fzd.thickness) AS thickness
    FROM with_session ws
    JOIN plc.furnace_zone_data fzd ON fzd.sheet = ws.sheet AND fzd.melt = ws.melt AND fzd.part_no = ws.part_no AND fzd.pack = ws.pack AND fzd.time = ws.time AND fzd.zone = ws.zone
    GROUP BY ws.sheet, ws.melt, ws.part_no, ws.pack
),
zones_paths AS (
    SELECT sheet, melt, part_no, pack, STRING_AGG(zone, '->' ORDER BY first_time) AS zones_path
    FROM (SELECT sheet, melt, part_no, pack, zone, MIN(time) AS first_time FROM with_session GROUP BY sheet, melt, part_no, pack, zone) zone_order
    GROUP BY sheet, melt, part_no, pack
)
SELECT agg.*, zp.zones_path
FROM agg
LEFT JOIN zones_paths zp ON zp.sheet = agg.sheet AND zp.melt = agg.melt AND zp.part_no = agg.part_no AND zp.pack = agg.pack
WHERE (agg.sheet, agg.melt, agg.part_no, agg.pack) NOT IN (SELECT sheet, melt, part_no, pack FROM plc.heating_sessions)
  AND agg.exited_at IS NOT NULL
  AND agg.total_minutes <= 35
  AND agg.exited_at < NOW() - INTERVAL '5 minutes'
ORDER BY agg.entered_at
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
WHERE (@From IS NULL OR entered_at >= @From)
  AND (@To IS NULL OR entered_at <= @To)
  AND (@Slab IS NULL OR slab = @Slab)
  AND (@Melt IS NULL OR melt = @Melt)
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

}