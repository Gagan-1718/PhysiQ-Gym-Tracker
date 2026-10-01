-- =============================================================================
-- PhysiQ Relational Schema (MySQL)
-- Normalized to 3NF
-- =============================================================================

CREATE DATABASE IF NOT EXISTS physiq_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE physiq_db;

-- -----------------------------------------------------------------------------
-- 1. Users Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('member', 'admin') DEFAULT 'member' NOT NULL,
    goal VARCHAR(50) DEFAULT 'hypertrophy', -- e.g., 'hypertrophy', 'strength', 'fat loss', 'maintenance'
    height DECIMAL(5,2) NULL COMMENT 'Height in cm',
    starting_weight DECIMAL(5,2) NULL COMMENT 'Starting weight in kg',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. Splits Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS splits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    split_name VARCHAR(100) NOT NULL, -- e.g., 'PPL', 'Upper/Lower', 'Bro Split', 'Custom'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. Split Days Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS split_days (
    id INT AUTO_INCREMENT PRIMARY KEY,
    split_id INT NOT NULL,
    body_part VARCHAR(50) NOT NULL, -- e.g., 'Push', 'Pull', 'Legs', 'Chest', 'Back'
    day_order INT DEFAULT 1,
    last_trained_date DATE NULL COMMENT 'Updated automatically via triggers',
    FOREIGN KEY (split_id) REFERENCES splits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. Exercises Table (Master Library)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercises (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    muscle_group VARCHAR(50) NOT NULL, -- e.g., 'Chest', 'Back', 'Quads', 'Hamstrings', 'Shoulders', 'Biceps', 'Triceps', 'Core'
    equipment_needed VARCHAR(100) DEFAULT 'Bodyweight', -- e.g., 'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight'
    instructions TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. Workout Sessions Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_date DATE NOT NULL,
    body_part VARCHAR(50) NOT NULL,
    total_volume DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Sum of weight x reps for non-warmup sets',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. Sets Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    exercise_id INT NOT NULL,
    set_number INT DEFAULT 1,
    reps INT NOT NULL CHECK (reps > 0),
    weight DECIMAL(6,2) NOT NULL CHECK (weight >= 0),
    is_warmup BOOLEAN DEFAULT FALSE,
    rpe DECIMAL(3,1) NULL COMMENT 'Rate of Perceived Exertion (1-10)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. Personal Records Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    exercise_id INT NOT NULL,
    weight DECIMAL(6,2) NOT NULL,
    reps INT NOT NULL,
    achieved_on DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_user_exercise_pr (user_id, exercise_id, weight, reps)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 8. Foods Table (Master Nutrition Library)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    calories DECIMAL(6,2) NOT NULL COMMENT 'kcal per 100g',
    protein DECIMAL(6,2) NOT NULL COMMENT 'grams per 100g',
    carbs DECIMAL(6,2) NOT NULL COMMENT 'grams per 100g',
    fat DECIMAL(6,2) NOT NULL COMMENT 'grams per 100g',
    serving_unit VARCHAR(50) DEFAULT '100g',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 9. Nutrition Logs Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nutrition_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    food_id INT NOT NULL,
    quantity DECIMAL(6,2) NOT NULL COMMENT 'Quantity in grams or standard serving',
    meal_type ENUM('Breakfast', 'Lunch', 'Dinner', 'Snack') DEFAULT 'Snack',
    log_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 10. Body Measurements Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS body_measurements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    weight DECIMAL(5,2) NULL COMMENT 'Weight in kg',
    waist DECIMAL(5,2) NULL COMMENT 'Waist circumference in cm',
    chest DECIMAL(5,2) NULL COMMENT 'Chest circumference in cm',
    arms DECIMAL(5,2) NULL COMMENT 'Arms circumference in cm',
    recorded_on DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
