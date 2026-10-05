-- =============================================================================
-- Seed Data: Realistic Sample User Workout & Nutrition History
-- Used for testing queries, stored procedures, triggers, and analytics views
-- =============================================================================

USE physiq_db;

-- 1. Test User
INSERT INTO users (id, name, email, password_hash, role, goal, height, starting_weight) 
VALUES (1, 'Alex Mercer', 'alex@physiq.test', '$2a$10$SampleHashedPasswordForDevelopmentOnly123', 'member', 'hypertrophy', 178.00, 75.00)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2. Active PPL Split for User 1
INSERT INTO splits (id, user_id, split_name, is_active)
VALUES (1, 1, 'Push / Pull / Legs (PPL)', TRUE)
ON DUPLICATE KEY UPDATE split_name = VALUES(split_name);

-- 3. Split Days (Pull is intentionally set as overdue)
INSERT INTO split_days (id, split_id, body_part, day_order, last_trained_date) VALUES
(1, 1, 'Push', 1, DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY)),
(2, 1, 'Pull', 2, DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY)), -- 6 days overdue!
(3, 1, 'Legs', 3, DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY))
ON DUPLICATE KEY UPDATE last_trained_date = VALUES(last_trained_date);

-- 4. Sample Past Workout Sessions
INSERT INTO workout_sessions (id, user_id, session_date, body_part, total_volume, notes) VALUES
(1, 1, DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY), 'Pull', 4320.00, 'Felt good on deadlifts'),
(2, 1, DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), 'Legs', 6240.00, 'Heavy squat day'),
(3, 1, DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), 'Push', 5100.00, 'Bench press volume progression')
ON DUPLICATE KEY UPDATE total_volume = VALUES(total_volume);

-- 5. Sample Sets for Session #3 (Push)
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(3, 1, 1, 12, 40.00, TRUE, 5.0),   -- Warmup Bench
(3, 1, 2, 8, 80.00, FALSE, 7.5),   -- Working set 1
(3, 1, 3, 8, 82.50, FALSE, 8.5),   -- Working set 2
(3, 1, 4, 6, 85.00, FALSE, 9.0),   -- Working set 3 (PR)
(3, 2, 1, 10, 26.00, FALSE, 8.0),  -- Incline DB Press
(3, 2, 2, 10, 28.00, FALSE, 8.5),
(3, 24, 1, 12, 35.00, FALSE, 8.0), -- Skull Crushers
(3, 24, 2, 10, 37.50, FALSE, 8.5)
ON DUPLICATE KEY UPDATE weight = VALUES(weight);

-- 6. Sample Personal Records
INSERT INTO personal_records (user_id, exercise_id, weight, reps, achieved_on) VALUES
(1, 1, 100.00, 5, DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY)),  -- Bench Press
(1, 6, 160.00, 3, DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY)),  -- Deadlift
(1, 15, 130.00, 5, DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY))  -- Squat
ON DUPLICATE KEY UPDATE weight = VALUES(weight);

-- 7. Sample Nutrition Logs for Today
INSERT INTO nutrition_logs (user_id, food_id, quantity, meal_type, log_date) VALUES
(1, 13, 80.00, 'Breakfast', CURRENT_DATE),   -- 80g Oats
(1, 5, 40.00, 'Breakfast', CURRENT_DATE),    -- 40g Whey
(1, 2, 200.00, 'Lunch', CURRENT_DATE),       -- 200g Cooked Chicken
(1, 12, 250.00, 'Lunch', CURRENT_DATE),      -- 250g Cooked Rice
(1, 20, 32.00, 'Snack', CURRENT_DATE)        -- 32g Peanut Butter
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity);

-- 8. Sample Body Measurements
INSERT INTO body_measurements (user_id, weight, waist, chest, arms, recorded_on) VALUES
(1, 75.00, 82.00, 101.00, 37.50, DATE_SUB(CURRENT_DATE, INTERVAL 21 DAY)),
(1, 74.40, 81.50, 101.50, 38.00, DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY)),
(1, 74.00, 80.50, 102.00, 38.20, DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)),
(1, 73.80, 80.00, 102.50, 38.50, CURRENT_DATE)
ON DUPLICATE KEY UPDATE weight = VALUES(weight);
