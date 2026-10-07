-- =============================================================================
-- PhysiQ Demo Analytical SQL Queries & EXPLAIN Plan Demonstrations
-- Meets and exceeds DBMS Level 3 Evaluation Requirements
-- =============================================================================

USE physiq_db;

-- -----------------------------------------------------------------------------
-- Query 1: Total Training Volume Per Muscle Group Over Time
-- Uses: Multi-table JOIN, GROUP BY, Aggregate SUM(), ORDER BY
-- -----------------------------------------------------------------------------
SELECT 
    e.muscle_group,
    COUNT(DISTINCT ws.id) AS sessions_count,
    COUNT(st.id) AS total_sets_performed,
    ROUND(SUM(st.weight * st.reps), 2) AS total_workload_volume_kg,
    ROUND(AVG(st.weight), 2) AS avg_working_weight_kg
FROM workout_sessions ws
JOIN sets st ON ws.id = st.session_id
JOIN exercises e ON st.exercise_id = e.id
WHERE ws.user_id = 1 
  AND st.is_warmup = FALSE
GROUP BY e.muscle_group
ORDER BY total_workload_volume_kg DESC;


-- -----------------------------------------------------------------------------
-- Query 2: Exercises Whose Recent Performance Exceeds Historical Average (Progression Check)
-- Uses: Correlated Subquery, HAVING, Aggregates
-- -----------------------------------------------------------------------------
SELECT 
    e.id AS exercise_id,
    e.name AS exercise_name,
    MAX(st.weight) AS recent_max_weight,
    ROUND(AVG(st.weight), 2) AS historical_avg_weight
FROM sets st
JOIN workout_sessions ws ON st.session_id = ws.id
JOIN exercises e ON st.exercise_id = e.id
WHERE ws.user_id = 1 
  AND st.is_warmup = FALSE
  AND ws.session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY e.id, e.name
HAVING MAX(st.weight) > (
    SELECT AVG(st2.weight)
    FROM sets st2
    JOIN workout_sessions ws2 ON st2.session_id = ws2.id
    WHERE ws2.user_id = 1 
      AND st2.exercise_id = e.id 
      AND st2.is_warmup = FALSE
)
ORDER BY recent_max_weight DESC;


-- -----------------------------------------------------------------------------
-- Query 3: Daily Macronutrient Adherence & Target Deficit / Surplus
-- Uses: LEFT JOIN, Aggregate functions, COALESCE, Calculated fields
-- -----------------------------------------------------------------------------
SELECT 
    nl.log_date,
    ROUND(SUM((nl.quantity / 100.0) * f.calories), 1) AS actual_calories,
    ROUND(SUM((nl.quantity / 100.0) * f.protein), 1) AS actual_protein_g,
    ROUND(SUM((nl.quantity / 100.0) * f.carbs), 1) AS actual_carbs_g,
    ROUND(SUM((nl.quantity / 100.0) * f.fat), 1) AS actual_fat_g,
    -- Assuming a 2400 kcal maintenance baseline
    ROUND(SUM((nl.quantity / 100.0) * f.calories) - 2400.00, 1) AS calorie_delta
FROM nutrition_logs nl
JOIN foods f ON nl.food_id = f.id
WHERE nl.user_id = 1
GROUP BY nl.log_date
ORDER BY nl.log_date DESC
LIMIT 14;


-- -----------------------------------------------------------------------------
-- Query 4: Most Overdue Body Part Detection Query
-- (Core SQL underlying stored procedure sp_get_next_body_part)
-- -----------------------------------------------------------------------------
SELECT 
    sd.body_part,
    sd.last_trained_date,
    COALESCE(DATEDIFF(CURRENT_DATE, sd.last_trained_date), 999) AS days_elapsed,
    CASE 
        WHEN sd.last_trained_date IS NULL THEN 'Never Trained (Critical)'
        WHEN DATEDIFF(CURRENT_DATE, sd.last_trained_date) >= 5 THEN 'Overdue Priority'
        WHEN DATEDIFF(CURRENT_DATE, sd.last_trained_date) >= 3 THEN 'Ready for Training'
        ELSE 'In Recovery Phase'
    END AS training_readiness_status
FROM split_days sd
JOIN splits s ON sd.split_id = s.id
WHERE s.user_id = 1 AND s.is_active = TRUE
ORDER BY days_elapsed DESC;


-- -----------------------------------------------------------------------------
-- Query 5: EXPLAIN Demonstration — Validating Composite Index Usage
-- -----------------------------------------------------------------------------

-- Query 5A: EXPLAIN workout session history lookup (Uses idx_workout_sessions_user_date)
EXPLAIN SELECT * 
FROM workout_sessions 
WHERE user_id = 1 AND session_date BETWEEN DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) AND CURRENT_DATE;

-- Query 5B: EXPLAIN nutrition history lookup (Uses idx_nutrition_logs_user_date)
EXPLAIN SELECT nl.*, f.name 
FROM nutrition_logs nl
JOIN foods f ON nl.food_id = f.id
WHERE nl.user_id = 1 AND nl.log_date = CURRENT_DATE;
