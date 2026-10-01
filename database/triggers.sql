-- =============================================================================
-- PhysiQ Database Triggers
-- Enforces business and domain rules at the database engine level
-- =============================================================================

USE physiq_db;

DELIMITER $$

-- -----------------------------------------------------------------------------
-- 1. Trigger: Update last_trained_date in split_days upon logging a workout
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_workout_session_insert$$
CREATE TRIGGER trg_after_workout_session_insert
AFTER INSERT ON workout_sessions
FOR EACH ROW
BEGIN
    -- Update last_trained_date for matching user's split_days where body_part matches
    UPDATE split_days sd
    JOIN splits s ON sd.split_id = s.id
    SET sd.last_trained_date = NEW.session_date
    WHERE s.user_id = NEW.user_id
      AND LOWER(TRIM(sd.body_part)) = LOWER(TRIM(NEW.body_part))
      AND s.is_active = TRUE;
END$$

-- -----------------------------------------------------------------------------
-- 2. Trigger: Automatically recalculate session volume after set insertion
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_set_insert$$
CREATE TRIGGER trg_after_set_insert
AFTER INSERT ON sets
FOR EACH ROW
BEGIN
    IF NEW.is_warmup = FALSE THEN
        UPDATE workout_sessions
        SET total_volume = total_volume + (NEW.weight * NEW.reps)
        WHERE id = NEW.session_id;
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- 3. Trigger: Automatically adjust session volume after set update
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_set_update$$
CREATE TRIGGER trg_after_set_update
AFTER UPDATE ON sets
FOR EACH ROW
BEGIN
    DECLARE old_val DECIMAL(10,2) DEFAULT 0.00;
    DECLARE new_val DECIMAL(10,2) DEFAULT 0.00;

    IF OLD.is_warmup = FALSE THEN
        SET old_val = OLD.weight * OLD.reps;
    END IF;

    IF NEW.is_warmup = FALSE THEN
        SET new_val = NEW.weight * NEW.reps;
    END IF;

    UPDATE workout_sessions
    SET total_volume = total_volume - old_val + new_val
    WHERE id = NEW.session_id;
END$$

-- -----------------------------------------------------------------------------
-- 4. Trigger: Automatically deduct volume if a set is deleted
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_set_delete$$
CREATE TRIGGER trg_after_set_delete
AFTER DELETE ON sets
FOR EACH ROW
BEGIN
    IF OLD.is_warmup = FALSE THEN
        UPDATE workout_sessions
        SET total_volume = total_volume - (OLD.weight * OLD.reps)
        WHERE id = OLD.session_id;
    END IF;
END$$

DELIMITER ;
