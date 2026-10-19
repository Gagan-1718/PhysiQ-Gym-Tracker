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
