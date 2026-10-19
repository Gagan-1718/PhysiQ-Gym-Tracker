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

DELIMITER ;
