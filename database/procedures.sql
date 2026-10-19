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
    RETURN ROUND(p_weight * (1 + p_reps / 30), 2);
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

DELIMITER ;
