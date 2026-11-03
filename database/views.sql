-- =============================================================================
-- PhysiQ Views
-- Read models for the dashboard and analytics. All derived values are computed
-- here from the normalised tables instead of being stored twice.
-- =============================================================================

USE physiq_db;

-- -----------------------------------------------------------------------------
-- 1. view_split_day_status — recovery status of every day in each user's
--    ACTIVE split, ranked by training priority (rank 1 = train this next).
--      new        never trained
--      recovering trained less than min_rest_days ago
--      ready      recovered
--      overdue    min_rest_days + 2 or more days ago
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_split_day_status AS
SELECT
    d.user_id,
    d.split_id,
    d.split_name,
    d.split_day_id,
    d.body_part,
    d.day_order,
    d.min_rest_days,
    d.last_trained_date,
    d.days_since,
    CASE
        WHEN d.days_since IS NULL                    THEN 'new'
        WHEN d.days_since <  d.min_rest_days         THEN 'recovering'
        WHEN d.days_since >= d.min_rest_days + 2     THEN 'overdue'
        ELSE 'ready'
    END AS status,
    GREATEST(d.min_rest_days - COALESCE(d.days_since, d.min_rest_days), 0) AS days_until_ready,
    ROW_NUMBER() OVER (
        PARTITION BY d.user_id
        ORDER BY
            CASE
                WHEN d.days_since IS NULL                THEN 0
                WHEN d.days_since >= d.min_rest_days + 2 THEN 1
                WHEN d.days_since >= d.min_rest_days     THEN 2
                ELSE 3
            END,
            d.last_trained_date ASC,
            d.day_order ASC
    ) AS priority_rank
FROM (
    SELECT
        s.user_id,
        s.id AS split_id,
        s.split_name,
        sd.id AS split_day_id,
        sd.body_part,
        sd.day_order,
        CAST(sd.min_rest_days AS SIGNED) AS min_rest_days, -- signed: avoids UNSIGNED underflow below
        sd.last_trained_date,
        DATEDIFF(CURRENT_DATE, sd.last_trained_date) AS days_since
    FROM splits s
    JOIN split_days sd ON sd.split_id = s.id
    WHERE s.is_active = TRUE
) AS d;

-- -----------------------------------------------------------------------------
-- 2. view_personal_records_detailed — each PR joined to the set that holds it
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_personal_records_detailed AS
SELECT
    pr.user_id,
    pr.exercise_id,
    e.name                               AS exercise_name,
    mg.name                              AS muscle_group,
    e.equipment_needed,
    s.id                                 AS set_id,
    s.weight,
    s.reps,
    fn_calculate_1rm(s.weight, s.reps)   AS estimated_1rm,
    ws.id                                AS session_id,
    ws.session_date                      AS achieved_on,
    pr.updated_at
FROM personal_records pr
JOIN sets s              ON s.id = pr.set_id
JOIN workout_sessions ws ON ws.id = s.session_id
JOIN exercises e         ON e.id = pr.exercise_id
JOIN muscle_groups mg    ON mg.id = e.muscle_group_id;

-- -----------------------------------------------------------------------------
-- 3. view_weekly_summary — sessions, volume, working sets and time per ISO week
--    (weeks start on Monday)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_weekly_summary AS
SELECT
    ws.user_id,
    DATE_SUB(ws.session_date, INTERVAL WEEKDAY(ws.session_date) DAY) AS week_start,
    COUNT(*)                                                         AS sessions_completed,
    SUM(ws.total_volume)                                             AS total_volume,
    SUM(COALESCE(sc.working_sets, 0))                                AS working_sets,
    SUM(COALESCE(TIMESTAMPDIFF(MINUTE, ws.started_at, ws.ended_at), 0)) AS minutes_trained,
    GROUP_CONCAT(DISTINCT ws.body_part ORDER BY ws.body_part SEPARATOR ', ') AS body_parts_trained
FROM workout_sessions ws
LEFT JOIN (
    SELECT session_id, COUNT(*) AS working_sets
    FROM sets
    WHERE is_warmup = FALSE
    GROUP BY session_id
) AS sc ON sc.session_id = ws.id
GROUP BY ws.user_id, week_start;

-- -----------------------------------------------------------------------------
-- 4. view_weekly_muscle_volume — working sets and volume per muscle per week
--    (weekly sets per muscle is the standard hypertrophy dose metric)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_weekly_muscle_volume AS
SELECT
    ws.user_id,
    DATE_SUB(ws.session_date, INTERVAL WEEKDAY(ws.session_date) DAY) AS week_start,
    mg.id                    AS muscle_group_id,
    mg.name                  AS muscle_group,
    COUNT(*)                 AS working_sets,
    SUM(s.weight * s.reps)   AS volume
FROM sets s
JOIN workout_sessions ws ON ws.id = s.session_id
JOIN exercises e         ON e.id = s.exercise_id
JOIN muscle_groups mg    ON mg.id = e.muscle_group_id
WHERE s.is_warmup = FALSE
GROUP BY ws.user_id, week_start, mg.id, mg.name;

-- -----------------------------------------------------------------------------
-- 5. view_exercise_session_best — per user, exercise and session: best
--    estimated 1RM, top weight, sets and volume (feeds strength-trend charts)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_exercise_session_best AS
SELECT
    ws.user_id,
    s.exercise_id,
    ws.id                                     AS session_id,
    ws.session_date,
    MAX(fn_calculate_1rm(s.weight, s.reps))   AS best_e1rm,
    MAX(s.weight)                             AS top_weight,
    COUNT(*)                                  AS working_sets,
    SUM(s.weight * s.reps)                    AS volume
FROM sets s
JOIN workout_sessions ws ON ws.id = s.session_id
WHERE s.is_warmup = FALSE
GROUP BY ws.user_id, s.exercise_id, ws.id, ws.session_date;

-- -----------------------------------------------------------------------------
-- 6. view_daily_nutrition_summary — daily macro targets vs logged totals and
--    meal count per user and day (feeds the Fuel & Nutrition dashboard)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_daily_nutrition_summary AS
SELECT
    f.user_id,
    f.fuel_date,
    f.calorie_target,
    f.calories_logged,
    f.protein_target_g,
    f.protein_logged_g,
    f.carbs_target_g,
    f.carbs_logged_g,
    f.fat_target_g,
    f.fat_logged_g,
    f.water_target_ml,
    f.water_logged_ml,
    ROUND(100 * f.calories_logged / NULLIF(f.calorie_target, 0))   AS calorie_pct,
    ROUND(100 * f.protein_logged_g / NULLIF(f.protein_target_g, 0)) AS protein_pct,
    ROUND(100 * f.water_logged_ml / NULLIF(f.water_target_ml, 0))   AS water_pct,
    COALESCE(m.meals_count, 0)                                      AS meals_count
FROM user_daily_fuel f
LEFT JOIN (
    SELECT user_id, fuel_date, COUNT(*) AS meals_count
    FROM meal_logs
    GROUP BY user_id, fuel_date
) AS m ON m.user_id = f.user_id AND m.fuel_date = f.fuel_date;

-- -----------------------------------------------------------------------------
-- 7. view_hydration_daily — daily hydration summary with entry count and
--    percentage of body-weight water goal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_hydration_daily AS
SELECT
    f.user_id,
    f.fuel_date,
    f.water_target_ml,
    f.water_logged_ml,
    ROUND(100 * f.water_logged_ml / NULLIF(f.water_target_ml, 0)) AS hydration_pct,
    COALESCE(w.entries_count, 0)                                  AS entries_count
FROM user_daily_fuel f
LEFT JOIN (
    SELECT user_id, fuel_date, COUNT(*) AS entries_count
    FROM water_logs
    GROUP BY user_id, fuel_date
) AS w ON w.user_id = f.user_id AND w.fuel_date = f.fuel_date;
