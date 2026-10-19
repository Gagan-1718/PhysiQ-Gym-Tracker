-- =============================================================================
-- PhysiQ Relational Schema (MySQL 8.0+)
-- 12 tables, normalised to 3NF (personal_records is in BCNF).
--
-- Run order (scripts/init-db.js does this for you):
--   schema.sql -> procedures.sql -> triggers.sql -> views.sql -> indexes.sql -> seeds/*
--
-- Two columns are deliberate, trigger-maintained caches of derivable values:
--   split_days.last_trained_date   = MAX(workout_sessions.session_date) for that day
--   workout_sessions.total_volume  = SUM(weight * reps) of that session's working sets
-- They make the dashboard an O(1) read; triggers keep them consistent on every
-- INSERT / UPDATE / DELETE (see triggers.sql and docs/DATABASE_DESIGN.md).
-- =============================================================================

CREATE DATABASE IF NOT EXISTS physiq_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE physiq_db;

-- -----------------------------------------------------------------------------
-- 1. users — members and admins (RBAC: role column)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL COMMENT 'bcrypt hash (10 rounds), never plaintext',
    role            ENUM('member', 'admin') NOT NULL DEFAULT 'member',
    goal            ENUM('hypertrophy', 'strength', 'fat_loss', 'maintenance') NOT NULL DEFAULT 'hypertrophy',
    height          DECIMAL(5,2) NULL COMMENT 'cm',
    starting_weight DECIMAL(5,2) NULL COMMENT 'kg, used until the first body measurement is logged',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_email CHECK (email LIKE '%_@_%._%'),
    CONSTRAINT chk_users_height CHECK (height IS NULL OR height BETWEEN 100 AND 250),
    CONSTRAINT chk_users_starting_weight CHECK (starting_weight IS NULL OR starting_weight BETWEEN 30 AND 300)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. muscle_groups — lookup table (domain integrity instead of free-text labels)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS muscle_groups (
    id     INT AUTO_INCREMENT PRIMARY KEY,
    name   VARCHAR(30) NOT NULL,
    region ENUM('upper', 'lower', 'core') NOT NULL,
    CONSTRAINT uq_muscle_groups_name UNIQUE (name)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. exercises — master library (only admins may change it; audited by triggers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercises (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,
    muscle_group_id  INT NOT NULL,
    equipment_needed ENUM('Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band', 'Other')
                     NOT NULL DEFAULT 'Bodyweight',
    instructions     TEXT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_exercises_name UNIQUE (name),
    CONSTRAINT fk_exercises_muscle_group FOREIGN KEY (muscle_group_id)
        REFERENCES muscle_groups(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. splits — a user's training splits; at most ONE active split per user
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS splits (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    split_name  VARCHAR(100) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    -- Generated column: 1 when active, NULL otherwise. UNIQUE ignores NULLs, so
    -- (user_id, active_slot) allows many inactive splits but only one active one.
    active_slot TINYINT GENERATED ALWAYS AS (IF(is_active, 1, NULL)) STORED,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_splits_one_active_per_user UNIQUE (user_id, active_slot),
    CONSTRAINT fk_splits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. split_days — ordered days of a split (e.g. Push / Pull / Legs)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS split_days (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    split_id          INT NOT NULL,
    body_part         VARCHAR(50) NOT NULL COMMENT 'day label, e.g. Push, Pull, Legs, Upper',
    day_order         TINYINT UNSIGNED NOT NULL,
    min_rest_days     TINYINT UNSIGNED NOT NULL DEFAULT 2 COMMENT 'recovery window before this day is ready again',
    last_trained_date DATE NULL COMMENT 'trigger-maintained cache of MAX(workout_sessions.session_date)',
    CONSTRAINT uq_split_days_order UNIQUE (split_id, day_order),
    CONSTRAINT uq_split_days_label UNIQUE (split_id, body_part),
    CONSTRAINT chk_split_days_order CHECK (day_order BETWEEN 1 AND 14),
    CONSTRAINT chk_split_days_rest CHECK (min_rest_days BETWEEN 0 AND 7),
    CONSTRAINT fk_split_days_split FOREIGN KEY (split_id) REFERENCES splits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. split_day_muscles — M:N between split days and the muscle groups they train
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS split_day_muscles (
    split_day_id    INT NOT NULL,
    muscle_group_id INT NOT NULL,
    PRIMARY KEY (split_day_id, muscle_group_id),
    CONSTRAINT fk_sdm_split_day FOREIGN KEY (split_day_id) REFERENCES split_days(id) ON DELETE CASCADE,
    CONSTRAINT fk_sdm_muscle_group FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. workout_sessions — one row per workout (header)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_sessions (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    split_day_id INT NULL COMMENT 'NULL for ad-hoc sessions or after the split is deleted',
    session_date DATE NOT NULL,
    body_part    VARCHAR(50) NOT NULL COMMENT 'label snapshot at training time, so history survives split edits',
    started_at   DATETIME NULL,
    ended_at     DATETIME NULL,
    total_volume DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'trigger-maintained: SUM(weight*reps) of working sets',
    notes        VARCHAR(500) NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sessions_times CHECK (started_at IS NULL OR ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT chk_sessions_volume CHECK (total_volume >= 0),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_split_day FOREIGN KEY (split_day_id) REFERENCES split_days(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 8. sets — individual sets performed in a session
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sets (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    session_id  INT NOT NULL,
    exercise_id INT NOT NULL,
    set_number  TINYINT UNSIGNED NOT NULL COMMENT '1-based, per exercise within the session',
    reps        SMALLINT UNSIGNED NOT NULL,
    weight      DECIMAL(6,2) NOT NULL DEFAULT 0.00 COMMENT 'kg; 0 for bodyweight',
    is_warmup   BOOLEAN NOT NULL DEFAULT FALSE,
    rpe         DECIMAL(3,1) NULL COMMENT 'Rate of Perceived Exertion 1-10',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sets_session_exercise_number UNIQUE (session_id, exercise_id, set_number),
    CONSTRAINT chk_sets_reps CHECK (reps BETWEEN 1 AND 100),
    CONSTRAINT chk_sets_weight CHECK (weight BETWEEN 0 AND 999.99),
    CONSTRAINT chk_sets_rpe CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
    CONSTRAINT chk_sets_number CHECK (set_number BETWEEN 1 AND 50),
    CONSTRAINT fk_sets_session FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sets_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 9. personal_records — points at each user's best set per exercise (BCNF)
--    Candidate keys: (user_id, exercise_id) and set_id. Weight, reps and date
--    are NOT copied here; they are read through set_id (no update anomalies).
--    "Best" = highest Epley 1RM, ties go to the heavier, then the earlier set.
--    Maintained automatically by triggers on sets / workout_sessions.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_records (
    user_id     INT NOT NULL,
    exercise_id INT NOT NULL,
    set_id      INT NOT NULL,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, exercise_id),
    CONSTRAINT uq_personal_records_set UNIQUE (set_id),
    CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pr_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pr_set FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE
) ENGINE=InnoDB;
