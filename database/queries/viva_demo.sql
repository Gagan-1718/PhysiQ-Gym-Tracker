-- =============================================================================
-- PhysiQ viva demo: run section by section in MySQL Workbench (or all at once:
--   mysql -u root -p -t < database/queries/viva_demo.sql )
--
-- Everything that writes is wrapped in a transaction and ROLLED BACK, so this
-- file can be run again and again without changing the demo data.
-- Before the viva run `npm run db:reset` once, so the seeded dates are fresh
-- (they are relative to the day the database was built).
-- =============================================================================

USE physiq_db;
SET @alex  = (SELECT id FROM users WHERE email = 'alex@physiq.test');
SET @admin = (SELECT id FROM users WHERE email = 'admin@physiq.test');

-- -----------------------------------------------------------------------------
-- 1. The design at a glance: 12 tables, 5 views, 11 triggers, 16 routines
-- -----------------------------------------------------------------------------
SELECT 'tables'   AS object, COUNT(*) AS n FROM information_schema.TABLES   WHERE TABLE_SCHEMA = 'physiq_db' AND TABLE_TYPE = 'BASE TABLE'
UNION ALL SELECT 'views',    COUNT(*) FROM information_schema.VIEWS     WHERE TABLE_SCHEMA = 'physiq_db'
UNION ALL SELECT 'triggers', COUNT(*) FROM information_schema.TRIGGERS  WHERE TRIGGER_SCHEMA = 'physiq_db'
UNION ALL SELECT 'routines', COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'physiq_db'
UNION ALL SELECT 'CHECK constraints', COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = 'physiq_db' AND CONSTRAINT_TYPE = 'CHECK'
UNION ALL SELECT 'foreign keys',      COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = 'physiq_db' AND CONSTRAINT_TYPE = 'FOREIGN KEY';

-- -----------------------------------------------------------------------------
-- 2. Adaptive scheduling: which split day is most overdue, and why
--    (the rule lives in the view; the procedure just takes rank 1)
-- -----------------------------------------------------------------------------
SELECT priority_rank, body_part, last_trained_date, days_since, min_rest_days, status, days_until_ready
FROM view_split_day_status
WHERE user_id = @alex
ORDER BY priority_rank;

CALL sp_get_next_body_part(@alex, @day_id, @next, @days, @status);
SELECT @next AS train_next, @days AS days_since, @status AS status;

-- -----------------------------------------------------------------------------
-- 3. ACID + triggers, live: log a Pull workout, watch the database react, undo it
-- -----------------------------------------------------------------------------
SET @pull = (SELECT sd.id FROM split_days sd JOIN splits s ON s.id = sd.split_id
             WHERE s.user_id = @alex AND s.is_active AND sd.body_part = 'Pull');
SET @deadlift = (SELECT id FROM exercises WHERE name = 'Barbell Deadlift');

-- BEFORE: last trained date, the deadlift personal record
SELECT 'before' AS moment, sd.last_trained_date,
       (SELECT CONCAT(weight, ' kg x ', reps) FROM view_personal_records_detailed
        WHERE user_id = @alex AND exercise_id = @deadlift) AS deadlift_pr
FROM split_days sd WHERE sd.id = @pull;

START TRANSACTION;

  INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part)
  VALUES (@alex, @pull, CURRENT_DATE, 'Pull');             -- BEFORE INSERT trigger validates it
  SET @s = LAST_INSERT_ID();

  INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup) VALUES
    (@s, @deadlift, 1, 8,  70.00, TRUE),                   -- warm-up: not counted
    (@s, @deadlift, 2, 9, 135.00, FALSE),                  -- 135 x 9 -> e1RM 175.5 beats 173.33
    (@s, @deadlift, 3, 8, 130.00, FALSE);

  -- INSIDE the transaction the triggers have already done their work:
  SELECT 'inside txn' AS moment,
         (SELECT total_volume FROM workout_sessions WHERE id = @s)    AS session_volume_by_trigger,
         (SELECT last_trained_date FROM split_days WHERE id = @pull)  AS split_day_last_trained;

  SELECT 'PR by trigger' AS what, weight, reps, estimated_1rm, achieved_on
  FROM view_personal_records_detailed WHERE user_id = @alex AND exercise_id = @deadlift;

  SELECT status, days_since FROM view_split_day_status WHERE split_day_id = @pull;   -- now "recovering"

ROLLBACK;                                                   -- nothing of the above is kept

SELECT 'after rollback' AS moment, sd.last_trained_date,
       (SELECT CONCAT(weight, ' kg x ', reps) FROM view_personal_records_detailed
        WHERE user_id = @alex AND exercise_id = @deadlift) AS deadlift_pr
FROM split_days sd WHERE sd.id = @pull;

-- -----------------------------------------------------------------------------
-- 4. Progressive overload, the Epley 1RM function and the 1RM calculator procedure
-- -----------------------------------------------------------------------------
CALL sp_estimate_next_target(@alex, @deadlift, @w, @r, @lw, @lr, @ld, @why);
SELECT @lw AS last_weight, @lr AS last_reps, @ld AS last_date, @w AS next_weight, @r AS next_reps, @why AS rationale;

SELECT fn_calculate_1rm(100, 1) AS one_rep, fn_calculate_1rm(100, 10) AS ten_reps, fn_calculate_1rm(80, 5) AS five_reps;

-- The Progress > Strength calculator is this procedure: a recursive CTE builds the rep table (1..12)
-- and it SIGNALs on impossible input (weight <= 0, reps outside 1..30).
CALL sp_rep_max_table(100, 5);

-- -----------------------------------------------------------------------------
-- 5. Daily fuel: targets from body weight and goal, with clamped logging
--    (rolled back so the demo numbers stay as seeded)
-- -----------------------------------------------------------------------------
START TRANSACTION;
  CALL sp_get_daily_fuel(@alex, CURRENT_DATE);
  CALL sp_log_fuel(@alex, CURRENT_DATE, 25, 500);
  CALL sp_log_fuel(@alex, CURRENT_DATE, -9999, 0);          -- clamped at 0, never negative
ROLLBACK;

-- -----------------------------------------------------------------------------
-- 6. Audit trail written by a trigger; the app sets @app_user_id to say WHO acted
-- -----------------------------------------------------------------------------
START TRANSACTION;
  SET @app_user_id = @admin;
  INSERT INTO exercises (name, muscle_group_id, equipment_needed)
  VALUES ('Viva Demo Press', (SELECT id FROM muscle_groups WHERE name = 'Chest'), 'Machine');
  UPDATE exercises SET name = 'Viva Demo Press v2' WHERE name = 'Viva Demo Press';
  SELECT a.action, u.name AS acted_by, a.details
  FROM admin_audit_logs a LEFT JOIN users u ON u.id = a.admin_id
  ORDER BY a.id DESC LIMIT 2;
ROLLBACK;
SET @app_user_id = NULL;

-- -----------------------------------------------------------------------------
-- 7. Analytical queries: window functions and gaps-and-islands
-- -----------------------------------------------------------------------------
-- 7a. Every set that beat all earlier sets of its exercise (running MAX over a window frame)
WITH scored AS (
    SELECT e.name AS exercise, ws.session_date, s.weight, s.reps,
           fn_calculate_1rm(s.weight, s.reps) AS e1rm,
           MAX(fn_calculate_1rm(s.weight, s.reps)) OVER (
               PARTITION BY s.exercise_id ORDER BY ws.session_date, s.id
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS previous_best
    FROM sets s
    JOIN workout_sessions ws ON ws.id = s.session_id
    JOIN exercises e         ON e.id = s.exercise_id
    WHERE ws.user_id = @alex AND s.is_warmup = FALSE
)
SELECT exercise, session_date, weight, reps, e1rm, ROUND(e1rm - previous_best, 2) AS improvement
FROM scored WHERE previous_best IS NOT NULL AND e1rm > previous_best
ORDER BY session_date DESC, exercise LIMIT 8;

-- 7b. Training streak in weeks: consecutive-week runs found with ROW_NUMBER (gaps and islands)
WITH active AS (
    SELECT DISTINCT week_start FROM view_weekly_summary WHERE user_id = @alex
), runs AS (
    SELECT week_start,
           DATEDIFF(week_start, '2000-01-03') DIV 7 - ROW_NUMBER() OVER (ORDER BY week_start) AS run_id
    FROM active
)
SELECT COUNT(*) AS weeks_in_run, MIN(week_start) AS from_week, MAX(week_start) AS to_week
FROM runs GROUP BY run_id ORDER BY to_week DESC;

-- -----------------------------------------------------------------------------
-- 8. Index proof. NOTE: with only ~20 demo rows MySQL correctly prefers a table
--    scan (it is cheaper than an index seek), so this plan shows "Table scan".
--    The proof of the index is the 60,000-row benchmark, which loads synthetic
--    users, compares range scan vs full scan with EXPLAIN ANALYZE and cleans up:
--        mysql -u root -p -t < database/queries/explain_benchmark.sql
--    Results are written up in docs/QUERY_PERFORMANCE_EXPLAIN.md
--    (7 rows / 0.07 ms with the index vs 60,019 rows / 27.5 ms without).
-- -----------------------------------------------------------------------------
EXPLAIN FORMAT=TREE
SELECT id, session_date, body_part FROM workout_sessions
WHERE user_id = @alex AND session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
ORDER BY session_date DESC;

-- =============================================================================
-- 9. Integrity demos (each statement FAILS on purpose: run them one at a time)
-- =============================================================================
-- Impossible set (CHECK constraint chk_sets_reps):
--   START TRANSACTION;
--   INSERT INTO workout_sessions (user_id, session_date, body_part) VALUES (@alex, CURRENT_DATE, 'Pull');
--   INSERT INTO sets (session_id, exercise_id, set_number, reps, weight) VALUES (LAST_INSERT_ID(), @deadlift, 1, 0, 100);
--   -- ERROR 3819: Check constraint 'chk_sets_reps' is violated.
--   ROLLBACK;
--
-- Workout in the future (BEFORE INSERT trigger raises SIGNAL):
--   INSERT INTO workout_sessions (user_id, session_date, body_part) VALUES (@alex, DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY), 'Pull');
--   -- ERROR 1644: session_date cannot be in the future
--
-- Two active splits for one member (generated column + unique index):
--   INSERT INTO splits (user_id, split_name, is_active) VALUES (@alex, 'Second active split', TRUE);
--   -- ERROR 1062: Duplicate entry for key 'uq_splits_one_active_per_user'
--
-- Deleting an exercise that has been trained (FK ON DELETE RESTRICT):
--   DELETE FROM exercises WHERE id = @deadlift;
--   -- ERROR 1451: Cannot delete or update a parent row

-- =============================================================================
-- 10. Editing a saved workout: UPDATE / DELETE triggers keep volume and PRs correct
--     (the app's "Edit" button does exactly these statements; rolled back here)
-- =============================================================================
START TRANSACTION;
SET @s = (SELECT id FROM workout_sessions WHERE user_id = @alex ORDER BY session_date DESC, id DESC LIMIT 1);
SELECT total_volume AS volume_before FROM workout_sessions WHERE id = @s;
UPDATE sets SET weight = weight + 10 WHERE session_id = @s AND is_warmup = FALSE ORDER BY id LIMIT 1;   -- warm-ups never count towards volume
SELECT total_volume AS volume_after_edit FROM workout_sessions WHERE id = @s;
DELETE FROM sets WHERE session_id = @s AND is_warmup = FALSE ORDER BY id DESC LIMIT 1;
SELECT total_volume AS volume_after_delete FROM workout_sessions WHERE id = @s;
ROLLBACK;
SELECT total_volume AS volume_restored FROM workout_sessions WHERE id = @s;

-- =============================================================================
-- 11. Least privilege: the web app does not connect as root
--     The roles exist in MySQL; the app logs in as MYSQL_APP_USER (role physiq_app).
-- =============================================================================
SHOW GRANTS FOR 'physiq_app'@'%';
SHOW GRANTS FOR 'physiq_readonly'@'%';
-- Then, in a second connection as the app account (mysql -u <MYSQL_APP_USER> -p physiq_db), one at a time:
--   SELECT COUNT(*) FROM users;                          -- works
--   CALL sp_get_next_body_part(@alex, @bp, @day, @why);   -- works: EXECUTE is granted
--   DROP TABLE users;                                    -- ERROR 1142: DROP command denied
--   ALTER TABLE users ADD COLUMN hacked INT;             -- ERROR 1142: ALTER command denied
--   CREATE USER 'intruder'@'%' IDENTIFIED BY 'x';        -- ERROR 1227: needs the CREATE USER privilege
