-- =============================================================================
-- EXPLAIN benchmark: proves the composite indexes matter at realistic scale.
--
-- Loads 600 synthetic users x 100 sessions (60,000 rows) with a recursive CTE,
-- compares the same query with and without idx_workout_sessions_user_date,
-- then deletes everything it created (FK cascades clean up).
--
-- Run:   mysql -u root -p -t < database/queries/explain_benchmark.sql
-- Results are written up in docs/QUERY_PERFORMANCE_EXPLAIN.md.
-- =============================================================================

USE physiq_db;
SET SESSION cte_max_recursion_depth = 100000;

-- 1. Synthetic users
INSERT INTO users (name, email, password_hash, role, goal, starting_weight)
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 600)
SELECT CONCAT('Bench User ', i), CONCAT('bench-', i, '@physiq.test'),
       '$2a$10$benchmarkbenchmarkbenchmarkbenchmarkbenchmarkbenchmar', 'member', 'hypertrophy', 75
FROM n;

-- 2. 100 sessions per synthetic user, spread over the last 400 days
INSERT INTO workout_sessions (user_id, session_date, body_part, total_volume)
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 100)
SELECT u.id, DATE_SUB(CURRENT_DATE, INTERVAL (n.i * 4 + u.id % 4) DAY),
       ELT(1 + n.i % 3, 'Push', 'Pull', 'Legs'), 0
FROM users u CROSS JOIN n
WHERE u.email LIKE 'bench-%@physiq.test';

ANALYZE TABLE workout_sessions;
SELECT COUNT(*) AS total_sessions FROM workout_sessions;

-- 3. One user's last 30 days, WITH the composite index
SET @u = (SELECT id FROM users WHERE email = 'bench-300@physiq.test');

EXPLAIN
SELECT id, session_date, body_part
FROM workout_sessions
WHERE user_id = @u AND session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
ORDER BY session_date DESC;

EXPLAIN ANALYZE
SELECT id, session_date, body_part
FROM workout_sessions
WHERE user_id = @u AND session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
ORDER BY session_date DESC;

-- 4. Same query with the index disabled: full table scan + filesort.
--    (The user_id foreign key is served by this same composite index, so no
--     other index on user_id exists for the optimiser to fall back on.)
EXPLAIN
SELECT id, session_date, body_part
FROM workout_sessions IGNORE INDEX (idx_workout_sessions_user_date)
WHERE user_id = @u AND session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
ORDER BY session_date DESC;

EXPLAIN ANALYZE
SELECT id, session_date, body_part
FROM workout_sessions IGNORE INDEX (idx_workout_sessions_user_date)
WHERE user_id = @u AND session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
ORDER BY session_date DESC;

-- 5. Clean up (cascades remove the synthetic sessions)
DELETE FROM users WHERE email LIKE 'bench-%@physiq.test';
ANALYZE TABLE workout_sessions;
SELECT COUNT(*) AS sessions_after_cleanup FROM workout_sessions;
