-- =============================================================================
-- PhysiQ Analytical Query Suite (viva demonstration)
-- Joins, GROUP BY / HAVING, correlated and anti-join subqueries, CTEs and
-- window functions over the demo member's history.
-- Run:  mysql -u root -p -t < database/queries/demo_analytical_queries.sql
-- =============================================================================

USE physiq_db;
SET @u = (SELECT id FROM users WHERE email = 'alex@physiq.test');

-- -----------------------------------------------------------------------------
-- Q1. Volume and working sets per muscle group, last 30 days
--     4-table JOIN, GROUP BY, aggregates
-- -----------------------------------------------------------------------------
SELECT mg.name                          AS muscle_group,
       COUNT(DISTINCT ws.id)            AS sessions,
       COUNT(*)                         AS working_sets,
       ROUND(SUM(s.weight * s.reps))    AS volume_kg,
       ROUND(COUNT(*) / 30 * 7, 1)      AS avg_sets_per_week
FROM workout_sessions ws
JOIN sets s           ON s.session_id = ws.id
JOIN exercises e      ON e.id = s.exercise_id
JOIN muscle_groups mg ON mg.id = e.muscle_group_id
WHERE ws.user_id = @u
  AND s.is_warmup = FALSE
  AND ws.session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY mg.id, mg.name
ORDER BY volume_kg DESC;

-- -----------------------------------------------------------------------------
-- Q2. Exercises whose recent top weight beats their all-time average
--     correlated subquery inside HAVING
-- -----------------------------------------------------------------------------
SELECT e.name                    AS exercise,
       MAX(s.weight)             AS recent_top_kg,
       (SELECT ROUND(AVG(s2.weight), 1)
        FROM sets s2
        JOIN workout_sessions ws2 ON ws2.id = s2.session_id
        WHERE ws2.user_id = @u AND s2.exercise_id = e.id AND s2.is_warmup = FALSE) AS all_time_avg_kg
FROM sets s
JOIN workout_sessions ws ON ws.id = s.session_id
JOIN exercises e         ON e.id = s.exercise_id
WHERE ws.user_id = @u
  AND s.is_warmup = FALSE
  AND ws.session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY)
GROUP BY e.id, e.name
HAVING MAX(s.weight) > (
    SELECT AVG(s3.weight)
    FROM sets s3
    JOIN workout_sessions ws3 ON ws3.id = s3.session_id
    WHERE ws3.user_id = @u AND s3.exercise_id = e.id AND s3.is_warmup = FALSE
)
ORDER BY recent_top_kg DESC;

-- -----------------------------------------------------------------------------
-- Q3. PR timeline: every set that beat all earlier sets of that exercise
--     window function with a running MAX over a ROWS frame
-- -----------------------------------------------------------------------------
WITH scored AS (
    SELECT e.name AS exercise, ws.session_date, s.weight, s.reps,
           fn_calculate_1rm(s.weight, s.reps) AS e1rm,
           MAX(fn_calculate_1rm(s.weight, s.reps)) OVER (
               PARTITION BY s.exercise_id
               ORDER BY ws.session_date, s.id
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ) AS previous_best
    FROM sets s
    JOIN workout_sessions ws ON ws.id = s.session_id
    JOIN exercises e         ON e.id = s.exercise_id
    WHERE ws.user_id = @u AND s.is_warmup = FALSE
)
SELECT exercise, session_date, weight, reps, e1rm,
       ROUND(e1rm - previous_best, 2) AS improvement
FROM scored
WHERE previous_best IS NOT NULL AND e1rm > previous_best
ORDER BY session_date DESC, exercise
LIMIT 15;

-- -----------------------------------------------------------------------------
-- Q4. Week-over-week volume change
--     CTE over a view + LAG()
-- -----------------------------------------------------------------------------
WITH weekly AS (
    SELECT week_start, sessions_completed, total_volume
    FROM view_weekly_summary
    WHERE user_id = @u
)
SELECT week_start,
       sessions_completed,
       ROUND(total_volume) AS volume_kg,
       ROUND(100 * (total_volume - LAG(total_volume) OVER w) / LAG(total_volume) OVER w, 1) AS pct_change
FROM weekly
WINDOW w AS (ORDER BY week_start)
ORDER BY week_start;

-- -----------------------------------------------------------------------------
-- Q5. Rest days between sessions, and the longest gap
--     LAG() on dates
-- -----------------------------------------------------------------------------
WITH gaps AS (
    SELECT session_date, body_part,
           DATEDIFF(session_date, LAG(session_date) OVER (ORDER BY session_date)) AS days_since_previous
    FROM workout_sessions
    WHERE user_id = @u
)
SELECT session_date, body_part, days_since_previous,
       MAX(days_since_previous) OVER () AS longest_gap
FROM gaps
ORDER BY session_date DESC
LIMIT 10;

-- -----------------------------------------------------------------------------
-- Q6. Top 3 sets ever per exercise (by estimated 1RM)
--     ROW_NUMBER() partitioned per exercise
-- -----------------------------------------------------------------------------
SELECT exercise, place, weight, reps, e1rm, session_date
FROM (
    SELECT e.name AS exercise, s.weight, s.reps, ws.session_date,
           fn_calculate_1rm(s.weight, s.reps) AS e1rm,
           ROW_NUMBER() OVER (PARTITION BY s.exercise_id
                              ORDER BY fn_calculate_1rm(s.weight, s.reps) DESC, ws.session_date) AS place
    FROM sets s
    JOIN workout_sessions ws ON ws.id = s.session_id
    JOIN exercises e         ON e.id = s.exercise_id
    WHERE ws.user_id = @u AND s.is_warmup = FALSE
) ranked
WHERE place <= 3
ORDER BY exercise, place;

-- -----------------------------------------------------------------------------
-- Q7. Adaptive schedule: which day to train next and why
--     view + stored procedure with OUT parameters
-- -----------------------------------------------------------------------------
SELECT priority_rank, body_part, last_trained_date, days_since, status, days_until_ready
FROM view_split_day_status
WHERE user_id = @u
ORDER BY priority_rank;

CALL sp_get_next_body_part(@u, @day_id, @next, @days, @status);
SELECT @next AS train_next, @days AS days_since, @status AS status;

-- -----------------------------------------------------------------------------
-- Q8. (Admin) Members inactive for 7+ days
--     anti-join with NOT EXISTS
-- -----------------------------------------------------------------------------
SELECT u.id, u.name, u.email,
       (SELECT MAX(session_date) FROM workout_sessions WHERE user_id = u.id) AS last_session
FROM users u
WHERE u.role = 'member'
  AND NOT EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.user_id = u.id
        AND ws.session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
  );
