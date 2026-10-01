-- =============================================================================
-- PhysiQ Relational Views
-- Centralized abstractions for reporting, dashboards, and analytical summaries
-- =============================================================================

USE physiq_db;

-- -----------------------------------------------------------------------------
-- 1. View: Daily Macro Totals
-- Aggregates logged food items into daily totals for calories, protein, carbs, and fat
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_daily_macro_totals AS
SELECT 
    nl.user_id,
    nl.log_date,
    ROUND(SUM((nl.quantity / 100.0) * f.calories), 2) AS total_calories,
    ROUND(SUM((nl.quantity / 100.0) * f.protein), 2) AS total_protein,
    ROUND(SUM((nl.quantity / 100.0) * f.carbs), 2) AS total_carbs,
    ROUND(SUM((nl.quantity / 100.0) * f.fat), 2) AS total_fat,
    COUNT(nl.id) AS meals_logged_count
FROM nutrition_logs nl
JOIN foods f ON nl.food_id = f.id
GROUP BY nl.user_id, nl.log_date;

-- -----------------------------------------------------------------------------
-- 2. View: User Personal Records with Exercise Details & Estimated 1RM
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_personal_records_detailed AS
SELECT 
    pr.id AS pr_id,
    pr.user_id,
    u.name AS user_name,
    e.id AS exercise_id,
    e.name AS exercise_name,
    e.muscle_group,
    pr.weight,
    pr.reps,
    ROUND(pr.weight * (1 + (pr.reps / 30.0)), 2) AS estimated_1rm,
    pr.achieved_on
FROM personal_records pr
JOIN exercises e ON pr.exercise_id = e.id
JOIN users u ON pr.user_id = u.id;

-- -----------------------------------------------------------------------------
-- 3. View: Weekly Workout & Nutrition Summary
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_weekly_summary AS
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    YEAR(ws.session_date) AS workout_year,
    WEEK(ws.session_date, 1) AS workout_week,
    COUNT(DISTINCT ws.id) AS total_sessions_completed,
    COALESCE(SUM(ws.total_volume), 0.00) AS total_weekly_volume,
    GROUP_CONCAT(DISTINCT ws.body_part ORDER BY ws.body_part SEPARATOR ', ') AS body_parts_trained
FROM users u
LEFT JOIN workout_sessions ws ON u.id = ws.user_id
GROUP BY u.id, u.name, YEAR(ws.session_date), WEEK(ws.session_date, 1);
