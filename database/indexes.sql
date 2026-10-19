-- =============================================================================
-- PhysiQ Performance Indexes (MySQL 8.0+)
-- Composite B-Tree indexes for the app's hot query paths. Each one is
-- left-prefixed by a foreign key column, so MySQL also uses it to enforce that
-- FK and silently drops the single-column index it created implicitly.
--
-- Indexes that come from constraints are declared in schema.sql instead:
--   uq_sets_session_exercise_number (session_id, exercise_id, set_number)
--       -> serves "sets of this session" (replaces idx_sets_session_exercise)
--   uq_body_measurements_user_day (user_id, recorded_on)
--       -> serves body-weight history (replaces idx_body_measurements_user_date)
--   personal_records PRIMARY KEY (user_id, exercise_id)
--       -> serves PR lookups (replaces idx_personal_records_user_exercise)
--
-- See docs/QUERY_PERFORMANCE_EXPLAIN.md for EXPLAIN output.
-- =============================================================================

USE physiq_db;

-- 1. Workout history: WHERE user_id = ? [AND session_date BETWEEN ...] ORDER BY session_date DESC
CREATE INDEX idx_workout_sessions_user_date
    ON workout_sessions (user_id, session_date DESC);

-- 2. Last-trained recomputation: MAX(session_date) WHERE split_day_id = ?
CREATE INDEX idx_workout_sessions_split_day_date
    ON workout_sessions (split_day_id, session_date);

-- 3. Exercise history, overload targets and PR detection: WHERE exercise_id = ? (joined to sessions)
CREATE INDEX idx_sets_exercise_session
    ON sets (exercise_id, session_id);
