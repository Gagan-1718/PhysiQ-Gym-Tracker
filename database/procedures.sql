-- =============================================================================
-- PhysiQ Stored Functions & Procedures
-- Business rules live in the database engine, so every client (the web app,
-- MySQL Workbench, scripts) gets identical behaviour.
-- Loaded BEFORE triggers.sql because the triggers call these procedures.
-- =============================================================================

USE physiq_db;

DELIMITER $$

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fn_calculate_1rm — Epley estimated one-rep max: weight * (1 + reps / 30)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_calculate_1rm$$
CREATE FUNCTION fn_calculate_1rm(p_weight DECIMAL(6,2), p_reps INT)
RETURNS DECIMAL(7,2)
DETERMINISTIC NO SQL
BEGIN
    IF p_weight IS NULL OR p_reps IS NULL OR p_reps <= 0 THEN
        RETURN 0.00;
    END IF;
    IF p_reps = 1 THEN
        RETURN p_weight;
    END IF;
    RETURN ROUND((p_weight * (30 + p_reps)) / 30.0, 2);
END$$

-- -----------------------------------------------------------------------------
-- fn_current_weight — latest logged body weight on or before a date,
-- falling back to the user's starting weight
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_current_weight$$
CREATE FUNCTION fn_current_weight(p_user_id INT, p_as_of DATE)
RETURNS DECIMAL(5,2)
READS SQL DATA
BEGIN
    DECLARE v_weight DECIMAL(5,2);
    SET v_weight = (
        SELECT bm.weight
        FROM body_measurements bm
        WHERE bm.user_id = p_user_id
          AND bm.recorded_on <= p_as_of
          AND bm.weight IS NOT NULL
        ORDER BY bm.recorded_on DESC
        LIMIT 1
    );
    IF v_weight IS NULL THEN
        SET v_weight = (SELECT u.starting_weight FROM users u WHERE u.id = p_user_id);
    END IF;
    RETURN v_weight;
END$$

-- -----------------------------------------------------------------------------
-- fn_starting_weight — a first-timer's opening working weight for an exercise:
-- body weight x exercises.start_bw_ratio (migration 003), rounded to the nearest
-- 2.5 kg plate step and never below 2.5 kg. 0 for bodyweight moves (no ratio);
-- NULL when the member's body weight is unknown.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_starting_weight$$
CREATE FUNCTION fn_starting_weight(p_user_id INT, p_exercise_id INT)
RETURNS DECIMAL(6,2)
READS SQL DATA
BEGIN
    DECLARE v_ratio DECIMAL(4,3);
    DECLARE v_body DECIMAL(5,2);
    SET v_ratio = (SELECT e.start_bw_ratio FROM exercises e WHERE e.id = p_exercise_id);
    IF v_ratio IS NULL THEN
        RETURN 0.00;
    END IF;
    SET v_body = fn_current_weight(p_user_id, CURRENT_DATE);
    IF v_body IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN GREATEST(2.50, ROUND(v_body * v_ratio / 2.5) * 2.5);
END$$

-- -----------------------------------------------------------------------------
-- Daily fuel formulas (replace the PLAN's single fn_get_daily_fuel_targets,
-- because a MySQL function can only return one value)
--   protein  = 2.0 g per kg body weight
--   water    = 0.04 L (40 ml) per kg, rounded to 50 ml
--   calories = ~33 kcal per kg maintenance, adjusted by goal
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_protein_target_g$$
CREATE FUNCTION fn_protein_target_g(p_weight DECIMAL(5,2))
RETURNS SMALLINT UNSIGNED
DETERMINISTIC NO SQL
BEGIN
    RETURN ROUND(p_weight * 2.0);
END$$

DROP FUNCTION IF EXISTS fn_water_target_ml$$
CREATE FUNCTION fn_water_target_ml(p_weight DECIMAL(5,2))
RETURNS SMALLINT UNSIGNED
DETERMINISTIC NO SQL
BEGIN
    RETURN ROUND(p_weight * 40 / 50) * 50;
END$$

DROP FUNCTION IF EXISTS fn_calorie_target$$
CREATE FUNCTION fn_calorie_target(p_weight DECIMAL(5,2), p_goal VARCHAR(20))
RETURNS SMALLINT UNSIGNED
DETERMINISTIC NO SQL
BEGIN
    DECLARE v_adjust INT DEFAULT 0;
    SET v_adjust = CASE p_goal
        WHEN 'hypertrophy' THEN 300
        WHEN 'strength'    THEN 200
        WHEN 'fat_loss'    THEN -400
        ELSE 0
    END;
    RETURN ROUND((p_weight * 33 + v_adjust) / 10) * 10;
END$$

DROP FUNCTION IF EXISTS fn_fat_target_g$$
CREATE FUNCTION fn_fat_target_g(p_weight DECIMAL(5,2))
RETURNS SMALLINT UNSIGNED
DETERMINISTIC NO SQL
BEGIN
    RETURN ROUND(p_weight * 0.9);
END$$

DROP FUNCTION IF EXISTS fn_carbs_target_g$$
CREATE FUNCTION fn_carbs_target_g(p_weight DECIMAL(5,2), p_goal VARCHAR(20))
RETURNS SMALLINT UNSIGNED
DETERMINISTIC NO SQL
BEGIN
    DECLARE v_kcal INT;
    DECLARE v_protein_kcal INT;
    DECLARE v_fat_kcal INT;
    SET v_kcal = fn_calorie_target(p_weight, p_goal);
    SET v_protein_kcal = fn_protein_target_g(p_weight) * 4;
    SET v_fat_kcal = fn_fat_target_g(p_weight) * 9;
    RETURN GREATEST(50, ROUND((v_kcal - v_protein_kcal - v_fat_kcal) / 4.0));
END$$

-- =============================================================================
-- INTEGRITY HELPERS (called by triggers)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sp_assert_valid_session — rules a CHECK constraint cannot express:
--   * CHECK cannot use CURRENT_DATE (non-deterministic)
--   * CHECK cannot look at another table (split day ownership)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_assert_valid_session$$
CREATE PROCEDURE sp_assert_valid_session(
    IN p_user_id INT,
    IN p_split_day_id INT,
    IN p_session_date DATE
)
BEGIN
    -- One day of tolerance absorbs client/server timezone differences.
    IF p_session_date > DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'session_date cannot be in the future';
    END IF;

    IF p_split_day_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM split_days sd
        JOIN splits s ON s.id = sd.split_id
        WHERE sd.id = p_split_day_id AND s.user_id = p_user_id
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'split_day_id does not belong to this user';
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- sp_refresh_last_trained — recompute the cached last_trained_date of one day
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_refresh_last_trained$$
CREATE PROCEDURE sp_refresh_last_trained(IN p_split_day_id INT)
BEGIN
    IF p_split_day_id IS NOT NULL THEN
        UPDATE split_days
        SET last_trained_date = (
            SELECT MAX(ws.session_date)
            FROM workout_sessions ws
            WHERE ws.split_day_id = p_split_day_id
        )
        WHERE id = p_split_day_id;
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- sp_check_and_update_pr — point personal_records at the user's best working
-- set for one exercise (highest Epley 1RM; ties -> heavier -> earlier).
-- Called by the sets triggers after every insert / update / delete.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_check_and_update_pr$$
CREATE PROCEDURE sp_check_and_update_pr(IN p_user_id INT, IN p_exercise_id INT)
BEGIN
    DECLARE v_best_set_id INT;

    SET v_best_set_id = (
        SELECT s.id
        FROM sets s
        JOIN workout_sessions ws ON ws.id = s.session_id
        WHERE ws.user_id = p_user_id
          AND s.exercise_id = p_exercise_id
          AND s.is_warmup = FALSE
        ORDER BY fn_calculate_1rm(s.weight, s.reps) DESC,
                 s.weight DESC,
                 s.reps DESC,
                 ws.session_date ASC,
                 s.id ASC
        LIMIT 1
    );

    IF v_best_set_id IS NULL THEN
        DELETE FROM personal_records
        WHERE user_id = p_user_id AND exercise_id = p_exercise_id;
    ELSE
        INSERT INTO personal_records (user_id, exercise_id, set_id)
        VALUES (p_user_id, p_exercise_id, v_best_set_id) AS new_pr
        ON DUPLICATE KEY UPDATE set_id = new_pr.set_id;
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- sp_rebuild_personal_records — recompute every PR of a user in one pass using
-- a window function. Used after a whole session is deleted (FK cascades do not
-- fire the sets triggers).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_rebuild_personal_records$$
CREATE PROCEDURE sp_rebuild_personal_records(IN p_user_id INT)
BEGIN
    INSERT INTO personal_records (user_id, exercise_id, set_id)
    SELECT ranked.user_id, ranked.exercise_id, ranked.set_id
    FROM (
        SELECT ws.user_id,
               s.exercise_id,
               s.id AS set_id,
               ROW_NUMBER() OVER (
                   PARTITION BY s.exercise_id
                   ORDER BY fn_calculate_1rm(s.weight, s.reps) DESC,
                            s.weight DESC,
                            s.reps DESC,
                            ws.session_date ASC,
                            s.id ASC
               ) AS rn
        FROM sets s
        JOIN workout_sessions ws ON ws.id = s.session_id
        WHERE ws.user_id = p_user_id
          AND s.is_warmup = FALSE
    ) AS ranked
    WHERE ranked.rn = 1
    ON DUPLICATE KEY UPDATE set_id = ranked.set_id;
END$$

-- =============================================================================
-- FEATURE PROCEDURES (called by the app)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sp_get_next_body_part — adaptive scheduling.
-- Picks the highest-priority day of the user's active split from
-- view_split_day_status: never trained > overdue > ready > recovering, then
-- longest since trained. Falls back to 'Full Body' when there is no split.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_get_next_body_part$$
CREATE PROCEDURE sp_get_next_body_part(
    IN  p_user_id INT,
    OUT p_split_day_id INT,
    OUT p_recommended_body_part VARCHAR(50),
    OUT p_days_since_last_trained INT,
    OUT p_status VARCHAR(12)
)
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

    SET p_split_day_id = NULL;
    SET p_recommended_body_part = NULL;
    SET p_days_since_last_trained = NULL;
    SET p_status = NULL;

    SELECT v.split_day_id, v.body_part, v.days_since, v.status
    INTO p_split_day_id, p_recommended_body_part, p_days_since_last_trained, p_status
    FROM view_split_day_status v
    WHERE v.user_id = p_user_id
    ORDER BY v.priority_rank
    LIMIT 1;

    IF p_recommended_body_part IS NULL THEN
        SET p_recommended_body_part = 'Full Body';
        SET p_status = 'new';
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- sp_estimate_next_target — progressive overload (double progression).
-- Looks at the top working set of the most recent session with this exercise:
--   reps >= 10  -> add 2.5 kg and reset to 8 reps
--   reps <  10  -> same weight, one more rep
--   bodyweight  -> one more rep
--   no history  -> weight NULL (user picks), 10 reps
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_estimate_next_target$$
CREATE PROCEDURE sp_estimate_next_target(
    IN  p_user_id INT,
    IN  p_exercise_id INT,
    OUT p_suggested_weight DECIMAL(6,2),
    OUT p_suggested_reps INT,
    OUT p_last_weight DECIMAL(6,2),
    OUT p_last_reps INT,
    OUT p_last_date DATE,
    OUT p_rationale VARCHAR(160)
)
BEGIN
    DECLARE v_last_session_id INT;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

    SET p_suggested_weight = NULL;
    SET p_suggested_reps = NULL;
    SET p_last_weight = NULL;
    SET p_last_reps = NULL;
    SET p_last_date = NULL;

    SET v_last_session_id = (
        SELECT s.session_id
        FROM sets s
        JOIN workout_sessions ws ON ws.id = s.session_id
        WHERE ws.user_id = p_user_id
          AND s.exercise_id = p_exercise_id
          AND s.is_warmup = FALSE
        ORDER BY ws.session_date DESC, ws.id DESC
        LIMIT 1
    );

    IF v_last_session_id IS NULL THEN
        -- First time: open with a weight scaled to body weight (fn_starting_weight)
        SET p_suggested_weight = fn_starting_weight(p_user_id, p_exercise_id);
        SET p_suggested_reps = 10;
        SET p_rationale = CASE
            WHEN p_suggested_weight IS NULL THEN 'First time: pick a weight you can lift for 10 clean reps.'
            WHEN p_suggested_weight = 0 THEN 'First time: bodyweight, aim for 10 clean reps.'
            ELSE 'First time: a starting weight for your body weight. Slide it if it feels off.'
        END;
    ELSE
        SELECT s.weight, s.reps
        INTO p_last_weight, p_last_reps
        FROM sets s
        WHERE s.session_id = v_last_session_id
          AND s.exercise_id = p_exercise_id
          AND s.is_warmup = FALSE
        ORDER BY s.weight DESC, s.reps DESC
        LIMIT 1;

        SET p_last_date = (SELECT session_date FROM workout_sessions WHERE id = v_last_session_id);

        IF p_last_weight = 0 THEN
            SET p_suggested_weight = 0.00;
            SET p_suggested_reps = LEAST(p_last_reps + 1, 100);
            SET p_rationale = 'Bodyweight: beat last time by one rep.';
        ELSEIF p_last_reps >= 10 THEN
            SET p_suggested_weight = LEAST(p_last_weight + 2.50, 999.99);
            SET p_suggested_reps = 8;
            SET p_rationale = CONCAT('You hit ', p_last_reps, ' reps last time. Add 2.5 kg and reset to 8.');
        ELSE
            SET p_suggested_weight = p_last_weight;
            SET p_suggested_reps = p_last_reps + 1;
            SET p_rationale = CONCAT('Same weight, aim for ', p_last_reps + 1, ' reps.');
        END IF;
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- sp_ensure_daily_fuel — create (or, for today, refresh) a day's fuel targets.
-- Past days are frozen; today's targets follow the latest weight and goal.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ensure_daily_fuel$$
CREATE PROCEDURE sp_ensure_daily_fuel(IN p_user_id INT, IN p_date DATE)
BEGIN
    DECLARE v_goal VARCHAR(20);
    DECLARE v_weight DECIMAL(5,2);

    SET v_goal = (SELECT goal FROM users WHERE id = p_user_id);
    IF v_goal IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unknown user';
    END IF;

    SET v_weight = COALESCE(fn_current_weight(p_user_id, p_date), 70.00);

    INSERT INTO user_daily_fuel (
        user_id, fuel_date,
        protein_target_g, water_target_ml, calorie_target,
        carbs_target_g, fat_target_g
    )
    VALUES (
        p_user_id, p_date,
        fn_protein_target_g(v_weight),
        fn_water_target_ml(v_weight),
        fn_calorie_target(v_weight, v_goal),
        fn_carbs_target_g(v_weight, v_goal),
        fn_fat_target_g(v_weight)
    ) AS new_fuel
    ON DUPLICATE KEY UPDATE
        protein_target_g = IF(user_daily_fuel.fuel_date >= CURRENT_DATE, new_fuel.protein_target_g, user_daily_fuel.protein_target_g),
        water_target_ml  = IF(user_daily_fuel.fuel_date >= CURRENT_DATE, new_fuel.water_target_ml,  user_daily_fuel.water_target_ml),
        calorie_target   = IF(user_daily_fuel.fuel_date >= CURRENT_DATE, new_fuel.calorie_target,   user_daily_fuel.calorie_target),
        carbs_target_g   = IF(user_daily_fuel.fuel_date >= CURRENT_DATE, new_fuel.carbs_target_g,   user_daily_fuel.carbs_target_g),
        fat_target_g     = IF(user_daily_fuel.fuel_date >= CURRENT_DATE, new_fuel.fat_target_g,     user_daily_fuel.fat_target_g);
END$$

-- -----------------------------------------------------------------------------
-- sp_get_daily_fuel — returns one row: the day's targets, progress and the
-- body weight they were derived from
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_get_daily_fuel$$
CREATE PROCEDURE sp_get_daily_fuel(IN p_user_id INT, IN p_date DATE)
BEGIN
    CALL sp_ensure_daily_fuel(p_user_id, p_date);

    SELECT f.fuel_date,
           f.protein_target_g, f.protein_logged_g,
           f.water_target_ml,  f.water_logged_ml,
           f.calorie_target,   f.calories_logged,
           f.carbs_target_g,   f.carbs_logged_g,
           f.fat_target_g,     f.fat_logged_g,
           fn_current_weight(p_user_id, p_date) AS body_weight_kg
    FROM user_daily_fuel f
    WHERE f.user_id = p_user_id AND f.fuel_date = p_date;
END$$

-- -----------------------------------------------------------------------------
-- sp_log_fuel — add (or subtract) protein grams / water ml for a day.
-- Values are clamped to the table's valid range instead of failing.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_log_fuel$$
CREATE PROCEDURE sp_log_fuel(
    IN p_user_id INT,
    IN p_date DATE,
    IN p_protein_delta_g INT,
    IN p_water_delta_ml INT
)
BEGIN
    CALL sp_ensure_daily_fuel(p_user_id, p_date);

    UPDATE user_daily_fuel
    SET protein_logged_g = LEAST(1000,  GREATEST(0, CAST(protein_logged_g AS SIGNED) + COALESCE(p_protein_delta_g, 0))),
        water_logged_ml  = LEAST(15000, GREATEST(0, CAST(water_logged_ml  AS SIGNED) + COALESCE(p_water_delta_ml, 0)))
    WHERE user_id = p_user_id AND fuel_date = p_date;

    CALL sp_get_daily_fuel(p_user_id, p_date);
END$$

-- -----------------------------------------------------------------------------
-- sp_log_meal — log a meal from the food library or a custom quick entry.
-- Ensures the day's fuel row exists first so the AFTER INSERT trigger on
-- meal_logs can increment calories/macros atomically.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_log_meal$$
CREATE PROCEDURE sp_log_meal(
    IN p_user_id INT,
    IN p_date DATE,
    IN p_meal_type VARCHAR(20),
    IN p_food_id INT,
    IN p_food_name VARCHAR(100),
    IN p_serving_label VARCHAR(50),
    IN p_servings DECIMAL(4,2),
    IN p_calories INT,
    IN p_protein_g DECIMAL(5,1),
    IN p_carbs_g DECIMAL(5,1),
    IN p_fat_g DECIMAL(5,1)
)
BEGIN
    DECLARE v_name VARCHAR(100);
    DECLARE v_label VARCHAR(50);
    DECLARE v_cal INT;
    DECLARE v_pro DECIMAL(5,1);
    DECLARE v_carb DECIMAL(5,1);
    DECLARE v_fat DECIMAL(5,1);
    DECLARE v_mult DECIMAL(4,2);

    CALL sp_ensure_daily_fuel(p_user_id, p_date);
    SET v_mult = COALESCE(p_servings, 1.00);

    IF p_food_id IS NOT NULL THEN
        SELECT name,
               serving_label,
               ROUND(calories * v_mult),
               ROUND(protein_g * v_mult, 1),
               ROUND(carbs_g * v_mult, 1),
               ROUND(fat_g * v_mult, 1)
        INTO v_name, v_label, v_cal, v_pro, v_carb, v_fat
        FROM foods
        WHERE id = p_food_id AND (user_id IS NULL OR user_id = p_user_id);

        IF v_name IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Food item not found';
        END IF;
    ELSE
        SET v_name  = p_food_name;
        SET v_label = COALESCE(p_serving_label, '1 serving');
        SET v_cal   = COALESCE(p_calories, 0);
        SET v_pro   = COALESCE(p_protein_g, 0.0);
        SET v_carb  = COALESCE(p_carbs_g, 0.0);
        SET v_fat   = COALESCE(p_fat_g, 0.0);
    END IF;

    INSERT INTO meal_logs (
        user_id, fuel_date, meal_type, food_id, food_name,
        serving_label, servings, calories, protein_g, carbs_g, fat_g
    )
    VALUES (
        p_user_id, p_date, COALESCE(p_meal_type, 'snack'), p_food_id, v_name,
        v_label, v_mult, v_cal, v_pro, v_carb, v_fat
    );

    SELECT id, user_id, DATE_FORMAT(fuel_date, '%Y-%m-%d') AS fuel_date,
           meal_type, food_id, food_name, serving_label, servings,
           calories, protein_g, carbs_g, fat_g, logged_at
    FROM meal_logs
    WHERE id = LAST_INSERT_ID();
END$$

-- -----------------------------------------------------------------------------
-- sp_delete_meal — delete a user's logged meal (AFTER DELETE trigger rolls back
-- the day's macro totals in user_daily_fuel).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_delete_meal$$
CREATE PROCEDURE sp_delete_meal(IN p_user_id INT, IN p_meal_id INT)
BEGIN
    DELETE FROM meal_logs
    WHERE id = p_meal_id AND user_id = p_user_id;

    SELECT ROW_COUNT() AS deleted;
END$$

-- -----------------------------------------------------------------------------
-- sp_log_water — log a timestamped hydration entry (glass, bottle, shaker).
-- Ensures the day's fuel row exists so trg_water_logs_ai increments
-- water_logged_ml automatically.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_log_water$$
CREATE PROCEDURE sp_log_water(
    IN p_user_id INT,
    IN p_date DATE,
    IN p_amount_ml INT,
    IN p_container_label VARCHAR(40)
)
BEGIN
    CALL sp_ensure_daily_fuel(p_user_id, p_date);

    INSERT INTO water_logs (user_id, fuel_date, amount_ml, container_label)
    VALUES (p_user_id, p_date, p_amount_ml, COALESCE(p_container_label, 'Glass'));

    SELECT id, user_id, DATE_FORMAT(fuel_date, '%Y-%m-%d') AS fuel_date,
           amount_ml, container_label, logged_at
    FROM water_logs
    WHERE id = LAST_INSERT_ID();
END$$

-- -----------------------------------------------------------------------------
-- sp_delete_water — delete a hydration entry (trg_water_logs_ad subtracts its
-- volume from user_daily_fuel.water_logged_ml).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_delete_water$$
CREATE PROCEDURE sp_delete_water(IN p_user_id INT, IN p_water_id INT)
BEGIN
    DELETE FROM water_logs
    WHERE id = p_water_id AND user_id = p_user_id;

    SELECT ROW_COUNT() AS deleted;
END$$

-- -----------------------------------------------------------------------------
-- sp_schema_stats — how many tables, views, triggers and routines the database
-- has. Used by /api/health. SQL SECURITY DEFINER: it reads the system catalogue
-- with the owner's rights, so the least-privilege application account (which can
-- not see triggers in information_schema) still gets the right answer.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_schema_stats$$
CREATE PROCEDURE sp_schema_stats()
SQL SECURITY DEFINER
READS SQL DATA
BEGIN
    SELECT
        (SELECT COUNT(*) FROM information_schema.TABLES   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE') AS tables_count,
        (SELECT COUNT(*) FROM information_schema.VIEWS    WHERE TABLE_SCHEMA = DATABASE()) AS views_count,
        (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()) AS triggers_count,
        (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()) AS routines_count;
END$$

-- -----------------------------------------------------------------------------
-- sp_rep_max_table — 1RM calculator. Given a set (weight x reps) it returns the
-- estimated one-rep max and the weight you could lift for 1..12 reps, using the
-- same Epley formula as fn_calculate_1rm (inverted: weight = 1RM / (1 + reps/30)).
-- A recursive CTE generates the rep counts, so the whole table is one query.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_rep_max_table$$
CREATE PROCEDURE sp_rep_max_table(IN p_weight DECIMAL(6,2), IN p_reps INT)
BEGIN
    DECLARE v_one_rm DECIMAL(7,2);

    IF p_weight IS NULL OR p_weight <= 0 OR p_reps IS NULL OR p_reps < 1 OR p_reps > 30 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'weight must be above 0 and reps between 1 and 30';
    END IF;

    SET v_one_rm = fn_calculate_1rm(p_weight, p_reps);

    WITH RECURSIVE n (reps) AS (
        SELECT 1
        UNION ALL
        SELECT reps + 1 FROM n WHERE reps < 12
    )
    SELECT reps,
           v_one_rm AS one_rm,
           CASE WHEN reps = 1 THEN v_one_rm
                ELSE ROUND(v_one_rm / (1 + reps / 30), 1) END AS weight_kg,
           ROUND(100 * CASE WHEN reps = 1 THEN 1 ELSE 1 / (1 + reps / 30) END) AS pct_of_one_rm
    FROM n
    ORDER BY reps;
END$$

DELIMITER ;
