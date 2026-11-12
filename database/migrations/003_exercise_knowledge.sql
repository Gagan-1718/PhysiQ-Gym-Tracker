-- =============================================================================
-- Migration 003: what the app knows about each exercise
--
-- 1. ALTER TABLE exercises:
--      weight_step_kg  how much heavier each working set gets in the guided
--                      workout (ramping sets: e.g. 112.5, 122.5, 132.5 kg).
--                      10 kg for heavy lower-body lifts, 5 kg for most barbell,
--                      machine and cable work, 2.5 kg for dumbbells and small
--                      isolation lifts, 0 for bodyweight moves.
--      start_bw_ratio  a first-timer's opening working weight as a fraction of
--                      body weight (per dumbbell for dumbbell lifts); NULL for
--                      bodyweight moves. Used by fn_starting_weight.
-- 2. muscle_regions:   the 15 regions of the body map (finer than muscle_groups:
--                      the three heads of the shoulder, lats vs traps vs lower
--                      back, abs vs obliques), each belonging to a muscle group.
-- 3. exercise_muscles: which regions an exercise works and how (primary or
--                      secondary): a many-to-many relationship with an attribute.
--
-- Runs once, after migration 002 and before procedures.sql (which uses the
-- new columns in fn_starting_weight / sp_estimate_next_target).
-- =============================================================================

USE physiq_db;

-- -----------------------------------------------------------------------------
-- 1. Progression data on the exercise itself
-- -----------------------------------------------------------------------------
ALTER TABLE exercises
    ADD COLUMN weight_step_kg DECIMAL(3,1) NOT NULL DEFAULT 5.0
        COMMENT 'added from one working set to the next in a guided workout; 0 = bodyweight'
        AFTER media_key,
    ADD COLUMN start_bw_ratio DECIMAL(4,3) NULL
        COMMENT 'first-timer opening weight = body weight x ratio (per dumbbell); NULL = bodyweight'
        AFTER weight_step_kg,
    ADD CONSTRAINT chk_exercises_weight_step CHECK (weight_step_kg IN (0.0, 2.5, 5.0, 10.0)),
    ADD CONSTRAINT chk_exercises_start_ratio CHECK (start_bw_ratio IS NULL OR start_bw_ratio BETWEEN 0.010 AND 3.000);

-- -----------------------------------------------------------------------------
-- 2. muscle_regions — lookup table for the body map
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS muscle_regions (
    code            VARCHAR(20) PRIMARY KEY,
    label           VARCHAR(40) NOT NULL,
    body_view       ENUM('front', 'back') NOT NULL COMMENT 'which side of the body map shows it',
    muscle_group_id INT NOT NULL,
    CONSTRAINT uq_muscle_regions_label UNIQUE (label),
    CONSTRAINT chk_muscle_regions_code CHECK (REGEXP_LIKE(code, '^[a-z]+(_[a-z]+)*$', 'c')),
    CONSTRAINT fk_muscle_regions_group FOREIGN KEY (muscle_group_id)
        REFERENCES muscle_groups(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. exercise_muscles — exercise <-> region, with the role of the muscle
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercise_muscles (
    exercise_id INT NOT NULL,
    region_code VARCHAR(20) NOT NULL,
    role        ENUM('primary', 'secondary') NOT NULL,
    PRIMARY KEY (exercise_id, region_code),
    CONSTRAINT fk_exercise_muscles_exercise FOREIGN KEY (exercise_id)
        REFERENCES exercises(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_muscles_region FOREIGN KEY (region_code)
        REFERENCES muscle_regions(code) ON DELETE RESTRICT
) ENGINE=InnoDB;
