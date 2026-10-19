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

DELIMITER ;
