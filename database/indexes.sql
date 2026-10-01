-- =============================================================================
-- PhysiQ Indexes & Performance Optimization
-- Specifically designed for frequent query patterns (time-series, user lookups, aggregations)
-- =============================================================================

USE physiq_db;

-- -----------------------------------------------------------------------------
-- 1. Composite Index on Workout Sessions (User ID + Session Date)
-- Optimizes workout history retrieval, calendar lookups, and date range filters
-- -----------------------------------------------------------------------------
CREATE INDEX idx_workout_sessions_user_date 
ON workout_sessions (user_id, session_date DESC);

-- -----------------------------------------------------------------------------
-- 2. Composite Index on Nutrition Logs (User ID + Log Date)
-- Optimizes daily macro aggregation and nutrition timeline queries
-- -----------------------------------------------------------------------------
CREATE INDEX idx_nutrition_logs_user_date 
ON nutrition_logs (user_id, log_date DESC);

-- -----------------------------------------------------------------------------
-- 3. Composite Index on Sets (Session ID + Exercise ID)
-- Speeds up set retrieval during workout reviews and volume calculations
-- -----------------------------------------------------------------------------
CREATE INDEX idx_sets_session_exercise 
ON sets (session_id, exercise_id);

-- -----------------------------------------------------------------------------
-- 4. Composite Index on Personal Records (User ID + Exercise ID)
-- Speeds up PR lookups when validating personal bests during workout submission
-- -----------------------------------------------------------------------------
CREATE INDEX idx_personal_records_user_exercise 
ON personal_records (user_id, exercise_id);

-- -----------------------------------------------------------------------------
-- 5. Index on Body Measurements (User ID + Recorded Date)
-- Speeds up progress charts and body weight progression queries
-- -----------------------------------------------------------------------------
CREATE INDEX idx_body_measurements_user_date 
ON body_measurements (user_id, recorded_on DESC);

-- -----------------------------------------------------------------------------
-- 6. Index on Exercises (Muscle Group)
-- Optimizes filtering exercises by muscle group in the exercise library
-- -----------------------------------------------------------------------------
CREATE INDEX idx_exercises_muscle_group 
ON exercises (muscle_group);
