-- =============================================================================
-- PhysiQ Stored Procedures & Functions
-- Encapsulating complex analytical logic, adaptive scheduling, and transactional operations
-- =============================================================================

USE physiq_db;

DELIMITER $$

-- -----------------------------------------------------------------------------
-- 1. Procedure: Adaptive Body Part Recommendation (get_next_body_part)
-- Identifies the most overdue body part based on user's active split and workout history
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_get_next_body_part$$
CREATE PROCEDURE sp_get_next_body_part (
    IN p_user_id INT,
    OUT p_recommended_body_part VARCHAR(50),
    OUT p_days_since_last_trained INT
)
BEGIN
    -- Select the body part in the active split that has not been trained for the longest time
    SELECT 
        sd.body_part,
        COALESCE(DATEDIFF(CURRENT_DATE, sd.last_trained_date), 999) AS days_elapsed
    INTO 
        p_recommended_body_part,
        p_days_since_last_trained
    FROM split_days sd
    JOIN splits s ON sd.split_id = s.id
    WHERE s.user_id = p_user_id
      AND s.is_active = TRUE
    ORDER BY 
        sd.last_trained_date IS NULL DESC, -- Prioritize never trained body parts
        sd.last_trained_date ASC,          -- Then oldest last_trained_date
        sd.day_order ASC
    LIMIT 1;

    -- If user has no active split, default to 'Full Body'
    IF p_recommended_body_part IS NULL THEN
        SET p_recommended_body_part = 'Full Body';
        SET p_days_since_last_trained = 0;
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- 2. Procedure: Progression Estimation (estimate_next_target)
-- Analyzes recent performance on an exercise and calculates next target load/reps
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_estimate_next_target$$
CREATE PROCEDURE sp_estimate_next_target (
    IN p_user_id INT,
    IN p_exercise_id INT,
    OUT p_suggested_weight DECIMAL(6,2),
    OUT p_suggested_reps INT
)
BEGIN
    DECLARE v_last_weight DECIMAL(6,2);
    DECLARE v_last_reps INT;

    -- Fetch the most recent top working set (non-warmup) for this exercise
    SELECT st.weight, st.reps
    INTO v_last_weight, v_last_reps
    FROM sets st
    JOIN workout_sessions ws ON st.session_id = ws.id
    WHERE ws.user_id = p_user_id
      AND st.exercise_id = p_exercise_id
      AND st.is_warmup = FALSE
    ORDER BY ws.session_date DESC, st.weight DESC, st.reps DESC
    LIMIT 1;

    -- Progressive Overload Rule:
    -- If achieved >= 10 reps, increment weight by 2.5kg and reset reps to 8
    -- Otherwise, aim for +1 rep at the same weight
    IF v_last_weight IS NOT NULL THEN
        IF v_last_reps >= 10 THEN
            SET p_suggested_weight = v_last_weight + 2.50;
            SET p_suggested_reps = 8;
        ELSE
            SET p_suggested_weight = v_last_weight;
            SET p_suggested_reps = v_last_reps + 1;
        END IF;
    ELSE
        -- Baseline recommendation for a new exercise
        SET p_suggested_weight = 20.00;
        SET p_suggested_reps = 10;
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- 3. Stored Function: Calculate Estimated 1-Rep Max (Epley Formula)
-- 1RM = Weight * (1 + Reps / 30)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_calculate_1rm$$
CREATE FUNCTION fn_calculate_1rm (
    p_weight DECIMAL(6,2),
    p_reps INT
)
RETURNS DECIMAL(6,2)
DETERMINISTIC
BEGIN
    DECLARE v_one_rm DECIMAL(6,2);
    IF p_reps <= 0 THEN
        RETURN 0.00;
    ELSEIF p_reps = 1 THEN
        RETURN p_weight;
    ELSE
        SET v_one_rm = p_weight * (1 + (p_reps / 30.0));
        RETURN ROUND(v_one_rm, 2);
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- 4. Procedure: Check and Record Personal Record (Atomically within workout)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_check_and_update_pr$$
CREATE PROCEDURE sp_check_and_update_pr (
    IN p_user_id INT,
    IN p_exercise_id INT,
    IN p_weight DECIMAL(6,2),
    IN p_reps INT,
    IN p_session_date DATE,
    OUT p_is_new_pr BOOLEAN
)
BEGIN
    DECLARE v_prev_max_weight DECIMAL(6,2) DEFAULT 0.00;
    DECLARE v_prev_max_reps INT DEFAULT 0;

    SET p_is_new_pr = FALSE;

    -- Find previous best weight for this user and exercise
    SELECT COALESCE(MAX(weight), 0.00)
    INTO v_prev_max_weight
    FROM personal_records
    WHERE user_id = p_user_id AND exercise_id = p_exercise_id;

    -- If current weight exceeds previous best, or same weight with more reps
    IF p_weight > v_prev_max_weight THEN
        INSERT INTO personal_records (user_id, exercise_id, weight, reps, achieved_on)
        VALUES (p_user_id, p_exercise_id, p_weight, p_reps, p_session_date)
        ON DUPLICATE KEY UPDATE 
            weight = p_weight, 
            reps = p_reps, 
            achieved_on = p_session_date;
        SET p_is_new_pr = TRUE;
    END IF;
END$$

DELIMITER ;
