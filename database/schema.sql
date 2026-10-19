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
