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

-- -----------------------------------------------------------------------------
-- 5. Stored Function: Calculate Target Protein Based on Bodyweight & Goal
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_calculate_daily_protein$$
CREATE FUNCTION fn_calculate_daily_protein (
    p_weight DECIMAL(5,2),
    p_goal VARCHAR(50)
)
RETURNS DECIMAL(5,1)
DETERMINISTIC
BEGIN
    DECLARE v_wt DECIMAL(5,2);
    SET v_wt = COALESCE(p_weight, 75.00);
    IF v_wt <= 0 THEN SET v_wt = 75.00; END IF;

    IF LOWER(COALESCE(p_goal, 'hypertrophy')) = 'strength' THEN
        RETURN ROUND(v_wt * 2.2, 1);
    ELSEIF LOWER(COALESCE(p_goal, 'hypertrophy')) = 'fat loss' THEN
        RETURN ROUND(v_wt * 2.2, 1);
    ELSE
        RETURN ROUND(v_wt * 2.0, 1);
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- 6. Stored Function: Calculate Target Hydration in Liters (40ml per kg)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_calculate_daily_water$$
CREATE FUNCTION fn_calculate_daily_water (
    p_weight DECIMAL(5,2)
)
RETURNS DECIMAL(4,2)
DETERMINISTIC
BEGIN
    DECLARE v_wt DECIMAL(5,2);
    SET v_wt = COALESCE(p_weight, 75.00);
    IF v_wt <= 0 THEN SET v_wt = 75.00; END IF;

    RETURN ROUND(v_wt * 0.04, 2);
END$$

-- -----------------------------------------------------------------------------
-- 7. Procedure: Get or Initialize User Daily Fuel & Recovery Protocol
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_get_daily_fuel_protocol$$
CREATE PROCEDURE sp_get_daily_fuel_protocol (
    IN p_user_id INT,
    IN p_date DATE
)
BEGIN
    DECLARE v_weight DECIMAL(5,2);
    DECLARE v_goal VARCHAR(50);
    DECLARE v_protein DECIMAL(5,1);
    DECLARE v_water DECIMAL(4,2);
    DECLARE v_cals INT;

    -- Retrieve latest weight and goal
    SELECT 
        COALESCE(
            (SELECT weight FROM body_measurements WHERE user_id = p_user_id ORDER BY recorded_on DESC LIMIT 1),
            u.starting_weight,
            75.00
        ),
        COALESCE(u.goal, 'hypertrophy')
    INTO v_weight, v_goal
    FROM users u
    WHERE u.id = p_user_id;

    SET v_protein = fn_calculate_daily_protein(v_weight, v_goal);
    SET v_water = fn_calculate_daily_water(v_weight);

    IF LOWER(v_goal) = 'hypertrophy' THEN
        SET v_cals = ROUND(v_weight * 33 + 300);
    ELSEIF LOWER(v_goal) = 'fat loss' THEN
        SET v_cals = ROUND(v_weight * 30 - 400);
    ELSE
        SET v_cals = ROUND(v_weight * 32);
    END IF;

    -- Upsert daily record
    INSERT INTO user_daily_fuel (user_id, log_date, protein_target_g, water_target_l, calorie_target)
    VALUES (p_user_id, p_date, v_protein, v_water, v_cals)
    ON DUPLICATE KEY UPDATE 
        protein_target_g = VALUES(protein_target_g),
        water_target_l = VALUES(water_target_l),
        calorie_target = VALUES(calorie_target);

    -- Return the active protocol
    SELECT id, user_id, log_date, protein_target_g, water_target_l, calorie_target,
           protein_completed, water_completed, sleep_hours, notes
    FROM user_daily_fuel
    WHERE user_id = p_user_id AND log_date = p_date;
END$$

DELIMITER ;
