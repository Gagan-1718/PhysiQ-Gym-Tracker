-- =============================================================================
-- Migration 001: nutrition tracking (food, meal and water logging)
--
-- The base design (schema.sql) tracked protein and water only. This migration
-- evolves the live schema without rebuilding it:
--   1. ALTER TABLE user_daily_fuel: add calorie / carbs / fat targets and totals,
--      placed with AFTER so the column order reads naturally, plus CHECK constraints
--   2. CREATE TABLE foods, meal_logs, water_logs (tables 13-15)
-- Triggers on meal_logs / water_logs (triggers.sql) keep the new totals in sync.
--
-- Runs once, right after schema.sql (scripts/init-db.js), before the procedures
-- that use these columns. MySQL 8.0 has no ADD COLUMN IF NOT EXISTS, so this
-- file is not meant to be run twice on the same database.
-- =============================================================================

USE physiq_db;

-- -----------------------------------------------------------------------------
-- 1. Extend user_daily_fuel (ALTER TABLE: new columns and constraints)
-- -----------------------------------------------------------------------------
ALTER TABLE user_daily_fuel
    ADD COLUMN carbs_target_g  SMALLINT UNSIGNED NOT NULL DEFAULT 250 AFTER calorie_target,
    ADD COLUMN fat_target_g    SMALLINT UNSIGNED NOT NULL DEFAULT 70  AFTER carbs_target_g,
    ADD COLUMN calories_logged SMALLINT UNSIGNED NOT NULL DEFAULT 0   AFTER water_logged_ml,
    ADD COLUMN carbs_logged_g  SMALLINT UNSIGNED NOT NULL DEFAULT 0   AFTER calories_logged,
    ADD COLUMN fat_logged_g    SMALLINT UNSIGNED NOT NULL DEFAULT 0   AFTER carbs_logged_g,
    ADD CONSTRAINT chk_fuel_calories CHECK (calories_logged <= 15000),
    ADD CONSTRAINT chk_fuel_carbs    CHECK (carbs_logged_g  <= 2000),
    ADD CONSTRAINT chk_fuel_fat      CHECK (fat_logged_g    <= 1000);

ALTER TABLE user_daily_fuel
    COMMENT = 'one row per member per day: targets frozen at creation, totals kept by triggers';

-- -----------------------------------------------------------------------------
-- 13. foods — master food library (user_id NULL = built-in staple food) plus
--     member-created custom foods (user_id = owner, cascaded on account delete)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foods (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NULL COMMENT 'NULL = system staple food; otherwise custom food owned by user',
    name          VARCHAR(100) NOT NULL,
    category      ENUM('protein', 'grains_carbs', 'dairy_eggs', 'fruits_veg', 'fats_nuts', 'drinks_supps', 'meals') NOT NULL DEFAULT 'meals',
    serving_label VARCHAR(50) NOT NULL DEFAULT '100 g',
    serving_grams SMALLINT UNSIGNED NOT NULL DEFAULT 100,
    calories      SMALLINT UNSIGNED NOT NULL,
    protein_g     DECIMAL(5,1) NOT NULL DEFAULT 0.0,
    carbs_g       DECIMAL(5,1) NOT NULL DEFAULT 0.0,
    fat_g         DECIMAL(5,1) NOT NULL DEFAULT 0.0,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_foods_serving_grams CHECK (serving_grams BETWEEN 1 AND 5000),
    CONSTRAINT chk_foods_calories CHECK (calories <= 5000),
    CONSTRAINT chk_foods_macros CHECK (protein_g >= 0 AND protein_g <= 500 AND carbs_g >= 0 AND carbs_g <= 1000 AND fat_g >= 0 AND fat_g <= 500),
    CONSTRAINT fk_foods_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 14. meal_logs — individual meal entries per user and day (breakfast, lunch,
--     dinner, snack). Macros are snapshotted at log time so editing/deleting a
--     custom food never rewrites historical logs.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_logs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    fuel_date     DATE NOT NULL,
    meal_type     ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL DEFAULT 'snack',
    food_id       INT NULL,
    food_name     VARCHAR(100) NOT NULL,
    serving_label VARCHAR(50) NOT NULL DEFAULT '1 serving',
    servings      DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    calories      SMALLINT UNSIGNED NOT NULL,
    protein_g     DECIMAL(5,1) NOT NULL DEFAULT 0.0,
    carbs_g       DECIMAL(5,1) NOT NULL DEFAULT 0.0,
    fat_g         DECIMAL(5,1) NOT NULL DEFAULT 0.0,
    logged_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_meal_servings CHECK (servings > 0 AND servings <= 20),
    CONSTRAINT chk_meal_calories CHECK (calories <= 5000),
    CONSTRAINT chk_meal_macros CHECK (protein_g >= 0 AND protein_g <= 500 AND carbs_g >= 0 AND carbs_g <= 1000 AND fat_g >= 0 AND fat_g <= 500),
    CONSTRAINT fk_meal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_meal_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 15. water_logs — timestamped hydration entries (glass, bottle, shaker, custom)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    fuel_date       DATE NOT NULL,
    amount_ml       SMALLINT UNSIGNED NOT NULL,
    container_label VARCHAR(40) NOT NULL DEFAULT 'Glass',
    logged_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_water_amount CHECK (amount_ml BETWEEN 50 AND 5000),
    CONSTRAINT fk_water_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
