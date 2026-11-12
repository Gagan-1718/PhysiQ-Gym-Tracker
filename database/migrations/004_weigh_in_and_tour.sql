-- =============================================================================
-- Migration 004: workout weigh-ins and the first-login app tour
--
-- 1. ALTER TABLE workout_sessions:
--      weight_before  body weight the member enters before the workout starts
--      weight_after   body weight entered when the workout is finished
--    Both optional (the member may skip the question) and in the same 30-300 kg
--    range as body_measurements.weight. trg_workout_sessions_ai (triggers.sql)
--    copies weight_before into body_measurements when that day has no weight
--    yet, so the body-weight chart and the fuel targets follow it.
-- 2. ALTER TABLE users:
--      tour_completed_at  when the member finished or skipped the app tour with
--                         Q, the coach from the logo. NULL = show the tour.
--
-- Runs once, after migration 003 and before triggers.sql.
-- =============================================================================

USE physiq_db;

ALTER TABLE workout_sessions
    ADD COLUMN weight_before DECIMAL(5,2) NULL COMMENT 'kg, body weight entered before the workout' AFTER ended_at,
    ADD COLUMN weight_after  DECIMAL(5,2) NULL COMMENT 'kg, body weight entered after the workout' AFTER weight_before,
    ADD CONSTRAINT chk_sessions_weight_before CHECK (weight_before IS NULL OR weight_before BETWEEN 30 AND 300),
    ADD CONSTRAINT chk_sessions_weight_after  CHECK (weight_after  IS NULL OR weight_after  BETWEEN 30 AND 300);

ALTER TABLE users
    ADD COLUMN tour_completed_at DATETIME NULL
        COMMENT 'member finished or skipped the first-login app tour; NULL = show it'
        AFTER weekly_goal;
