-- =============================================================================
-- PhysiQ Triggers
-- Keep derived data (volume, last-trained dates, personal records, audit log)
-- consistent no matter which client writes to the database.
--
-- Note: MySQL does not fire triggers for rows removed by a FOREIGN KEY
-- cascade, so deleting a whole session is handled by the session triggers.
-- =============================================================================

USE physiq_db;

DELIMITER $$

-- =============================================================================
-- workout_sessions
-- =============================================================================

-- 1. Validate before insert (future dates, split-day ownership)
DROP TRIGGER IF EXISTS trg_workout_sessions_bi$$
CREATE TRIGGER trg_workout_sessions_bi
BEFORE INSERT ON workout_sessions
FOR EACH ROW
BEGIN
    CALL sp_assert_valid_session(NEW.user_id, NEW.split_day_id, NEW.session_date);
END$$

-- 2. Validate before update; a session can never move to another user
DROP TRIGGER IF EXISTS trg_workout_sessions_bu$$
CREATE TRIGGER trg_workout_sessions_bu
BEFORE UPDATE ON workout_sessions
FOR EACH ROW
BEGIN
    IF NEW.user_id <> OLD.user_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A workout session cannot be moved to another user';
    END IF;
    IF NOT (NEW.split_day_id <=> OLD.split_day_id) OR NEW.session_date <> OLD.session_date THEN
        CALL sp_assert_valid_session(NEW.user_id, NEW.split_day_id, NEW.session_date);
    END IF;
END$$

-- 3. Mark the split day as trained (never moves the date backwards)
DROP TRIGGER IF EXISTS trg_workout_sessions_ai$$
CREATE TRIGGER trg_workout_sessions_ai
AFTER INSERT ON workout_sessions
FOR EACH ROW
BEGIN
    IF NEW.split_day_id IS NOT NULL THEN
        UPDATE split_days
        SET last_trained_date = GREATEST(COALESCE(last_trained_date, NEW.session_date), NEW.session_date)
        WHERE id = NEW.split_day_id;
    END IF;
END$$

-- 4. Date or split day changed -> recompute both affected days
DROP TRIGGER IF EXISTS trg_workout_sessions_au$$
CREATE TRIGGER trg_workout_sessions_au
AFTER UPDATE ON workout_sessions
FOR EACH ROW
BEGIN
    IF NOT (NEW.split_day_id <=> OLD.split_day_id) OR NEW.session_date <> OLD.session_date THEN
        CALL sp_refresh_last_trained(OLD.split_day_id);
        IF NOT (NEW.split_day_id <=> OLD.split_day_id) THEN
            CALL sp_refresh_last_trained(NEW.split_day_id);
        END IF;
    END IF;
END$$

-- 5. Session deleted (its sets and their PR rows went with it via cascade):
--    roll last_trained_date back and promote the next-best sets to PRs
DROP TRIGGER IF EXISTS trg_workout_sessions_ad$$
CREATE TRIGGER trg_workout_sessions_ad
AFTER DELETE ON workout_sessions
FOR EACH ROW
BEGIN
    CALL sp_refresh_last_trained(OLD.split_day_id);
    CALL sp_rebuild_personal_records(OLD.user_id);
END$$

-- =============================================================================
-- sets: session volume + automatic personal-record detection
-- =============================================================================

-- 6. New set -> add its volume and check for a PR
DROP TRIGGER IF EXISTS trg_sets_ai$$
CREATE TRIGGER trg_sets_ai
AFTER INSERT ON sets
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT;

    IF NEW.is_warmup = FALSE THEN
        UPDATE workout_sessions
        SET total_volume = total_volume + NEW.weight * NEW.reps
        WHERE id = NEW.session_id;
    END IF;

    SET v_user_id = (SELECT user_id FROM workout_sessions WHERE id = NEW.session_id);
    CALL sp_check_and_update_pr(v_user_id, NEW.exercise_id);
END$$

-- 7. Edited set -> swap old volume for new and re-check PRs
DROP TRIGGER IF EXISTS trg_sets_au$$
CREATE TRIGGER trg_sets_au
AFTER UPDATE ON sets
FOR EACH ROW
BEGIN
    DECLARE v_old_user_id INT;
    DECLARE v_new_user_id INT;

    IF OLD.is_warmup = FALSE THEN
        UPDATE workout_sessions
        SET total_volume = total_volume - OLD.weight * OLD.reps
        WHERE id = OLD.session_id;
    END IF;
    IF NEW.is_warmup = FALSE THEN
        UPDATE workout_sessions
        SET total_volume = total_volume + NEW.weight * NEW.reps
        WHERE id = NEW.session_id;
    END IF;

    SET v_new_user_id = (SELECT user_id FROM workout_sessions WHERE id = NEW.session_id);
    CALL sp_check_and_update_pr(v_new_user_id, NEW.exercise_id);

    IF OLD.exercise_id <> NEW.exercise_id OR OLD.session_id <> NEW.session_id THEN
        SET v_old_user_id = (SELECT user_id FROM workout_sessions WHERE id = OLD.session_id);
        CALL sp_check_and_update_pr(v_old_user_id, OLD.exercise_id);
    END IF;
END$$

-- 8. Deleted set -> remove its volume; if it was the PR, the next best takes over
DROP TRIGGER IF EXISTS trg_sets_ad$$
CREATE TRIGGER trg_sets_ad
AFTER DELETE ON sets
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT;

    IF OLD.is_warmup = FALSE THEN
        UPDATE workout_sessions
        SET total_volume = total_volume - OLD.weight * OLD.reps
        WHERE id = OLD.session_id;
    END IF;

    SET v_user_id = (SELECT user_id FROM workout_sessions WHERE id = OLD.session_id);
    IF v_user_id IS NOT NULL THEN
        CALL sp_check_and_update_pr(v_user_id, OLD.exercise_id);
    END IF;
END$$

DELIMITER ;
