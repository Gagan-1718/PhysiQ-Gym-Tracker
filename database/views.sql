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
