-- =============================================================================
-- Seed: demo accounts + 5 weeks of training history (GENERATED FILE)
-- Regenerate with: node scripts/generate-demo-data.js
-- Demo logins (password "physiq123"): alex@physiq.test (member), admin@physiq.test (admin)
-- =============================================================================

USE physiq_db;

-- Demo accounts
INSERT INTO users (name, email, password_hash, role, goal, height, starting_weight) VALUES
('PhysiQ Admin', 'admin@physiq.test', '$2a$10$tvEaJlUNMX8eOuW5rgrRRuMZUAJLcxRcz3lQoKVgZ3SxVCQYdbQLK', 'admin', 'maintenance', 175.00, 72.00),
('Alex Mercer', 'alex@physiq.test', '$2a$10$tvEaJlUNMX8eOuW5rgrRRuMZUAJLcxRcz3lQoKVgZ3SxVCQYdbQLK', 'member', 'hypertrophy', 178.00, 76.00);
SET @alex = (SELECT id FROM users WHERE email = 'alex@physiq.test');

-- An older, inactive split (only one split per user may be active)
INSERT INTO splits (user_id, split_name, is_active) VALUES (@alex, 'Upper / Lower', FALSE);
SET @old_split = LAST_INSERT_ID();
INSERT INTO split_days (split_id, body_part, day_order) VALUES (@old_split, 'Upper', 1), (@old_split, 'Lower', 2);

-- Active Push / Pull / Legs split
INSERT INTO splits (user_id, split_name, is_active) VALUES (@alex, 'Push / Pull / Legs', TRUE);
SET @ppl = LAST_INSERT_ID();
INSERT INTO split_days (split_id, body_part, day_order, min_rest_days) VALUES
(@ppl, 'Push', 1, 2), (@ppl, 'Pull', 2, 2), (@ppl, 'Legs', 3, 2);
SET @day_push = (SELECT id FROM split_days WHERE split_id = @ppl AND body_part = 'Push');
SET @day_pull = (SELECT id FROM split_days WHERE split_id = @ppl AND body_part = 'Pull');
SET @day_legs = (SELECT id FROM split_days WHERE split_id = @ppl AND body_part = 'Legs');
INSERT INTO split_day_muscles (split_day_id, muscle_group_id)
SELECT d.id, mg.id FROM split_days d JOIN muscle_groups mg
  ON (d.body_part = 'Push' AND mg.name IN ('Chest', 'Shoulders', 'Triceps'))
  OR (d.body_part = 'Pull' AND mg.name IN ('Back', 'Biceps'))
  OR (d.body_part = 'Legs' AND mg.name IN ('Quads', 'Hamstrings', 'Glutes', 'Calves'))
WHERE d.split_id = @ppl;
INSERT INTO split_day_muscles (split_day_id, muscle_group_id)
SELECT d.id, mg.id FROM split_days d JOIN muscle_groups mg
  ON (d.body_part = 'Upper' AND mg.region = 'upper') OR (d.body_part = 'Lower' AND mg.region = 'lower')
WHERE d.split_id = @old_split;

-- Exercise ids
SET @ex_barbell_bench_press = (SELECT id FROM exercises WHERE name = 'Barbell Bench Press');
SET @ex_incline_dumbbell_press = (SELECT id FROM exercises WHERE name = 'Incline Dumbbell Press');
SET @ex_dumbbell_lateral_raise = (SELECT id FROM exercises WHERE name = 'Dumbbell Lateral Raise');
SET @ex_triceps_rope_pushdown = (SELECT id FROM exercises WHERE name = 'Triceps Rope Pushdown');
SET @ex_barbell_deadlift = (SELECT id FROM exercises WHERE name = 'Barbell Deadlift');
SET @ex_lat_pulldown = (SELECT id FROM exercises WHERE name = 'Lat Pulldown');
SET @ex_seated_cable_row = (SELECT id FROM exercises WHERE name = 'Seated Cable Row');
SET @ex_hammer_curl = (SELECT id FROM exercises WHERE name = 'Hammer Curl');
SET @ex_barbell_back_squat = (SELECT id FROM exercises WHERE name = 'Barbell Back Squat');
SET @ex_romanian_deadlift = (SELECT id FROM exercises WHERE name = 'Romanian Deadlift');
SET @ex_leg_press = (SELECT id FROM exercises WHERE name = 'Leg Press');
SET @ex_standing_calf_raise = (SELECT id FROM exercises WHERE name = 'Standing Calf Raise');

-- Push, 35 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_push, DATE_SUB(CURRENT_DATE, INTERVAL 35 DAY), 'Push', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 35 DAY), '18:25:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 35 DAY), '19:33:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_bench_press, 1, 10, 35.00, TRUE, NULL),
(@s, @ex_barbell_bench_press, 2, 8, 70.00, FALSE, 8.5),
(@s, @ex_barbell_bench_press, 3, 7, 70.00, FALSE, 9.5),
(@s, @ex_barbell_bench_press, 4, 6, 70.00, FALSE, 9.0),
(@s, @ex_incline_dumbbell_press, 1, 9, 24.00, FALSE, 8.0),
(@s, @ex_incline_dumbbell_press, 2, 8, 24.00, FALSE, 9.5),
(@s, @ex_incline_dumbbell_press, 3, 7, 24.00, FALSE, 9.5),
(@s, @ex_dumbbell_lateral_raise, 1, 11, 10.00, FALSE, 9.0),
(@s, @ex_dumbbell_lateral_raise, 2, 10, 10.00, FALSE, 9.0),
(@s, @ex_dumbbell_lateral_raise, 3, 9, 10.00, FALSE, 9.0),
(@s, @ex_triceps_rope_pushdown, 1, 10, 25.00, FALSE, 9.0),
(@s, @ex_triceps_rope_pushdown, 2, 9, 25.00, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 3, 8, 25.00, FALSE, 8.5);

-- Pull, 33 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_pull, DATE_SUB(CURRENT_DATE, INTERVAL 33 DAY), 'Pull', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 33 DAY), '17:43:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 33 DAY), '18:50:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_deadlift, 1, 10, 65.00, TRUE, NULL),
(@s, @ex_barbell_deadlift, 2, 5, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 3, 4, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 4, 3, 130.00, FALSE, 9.0),
(@s, @ex_lat_pulldown, 1, 9, 55.00, FALSE, 8.5),
(@s, @ex_lat_pulldown, 2, 8, 55.00, FALSE, 9.5),
(@s, @ex_lat_pulldown, 3, 7, 55.00, FALSE, 9.5),
(@s, @ex_seated_cable_row, 1, 10, 55.00, FALSE, 9.0),
(@s, @ex_seated_cable_row, 2, 9, 55.00, FALSE, 9.5),
(@s, @ex_seated_cable_row, 3, 8, 55.00, FALSE, 9.0),
(@s, @ex_hammer_curl, 1, 10, 14.00, FALSE, 8.0),
(@s, @ex_hammer_curl, 2, 9, 14.00, FALSE, 8.5),
(@s, @ex_hammer_curl, 3, 8, 14.00, FALSE, 9.5);

-- Legs, 32 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_legs, DATE_SUB(CURRENT_DATE, INTERVAL 32 DAY), 'Legs', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 32 DAY), '17:46:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 32 DAY), '18:41:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_back_squat, 1, 10, 50.00, TRUE, NULL),
(@s, @ex_barbell_back_squat, 2, 6, 100.00, FALSE, 8.5),
(@s, @ex_barbell_back_squat, 3, 5, 100.00, FALSE, 8.5),
(@s, @ex_barbell_back_squat, 4, 4, 100.00, FALSE, 9.0),
(@s, @ex_romanian_deadlift, 1, 8, 80.00, FALSE, 8.0),
(@s, @ex_romanian_deadlift, 2, 7, 80.00, FALSE, 8.5),
(@s, @ex_romanian_deadlift, 3, 6, 80.00, FALSE, 9.5),
(@s, @ex_leg_press, 1, 10, 160.00, FALSE, 9.0),
(@s, @ex_leg_press, 2, 9, 160.00, FALSE, 8.5),
(@s, @ex_leg_press, 3, 8, 160.00, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 1, 12, 60.00, FALSE, 8.0),
(@s, @ex_standing_calf_raise, 2, 11, 60.00, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 3, 10, 60.00, FALSE, 9.5);

-- Push, 30 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_push, DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY), 'Push', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY), '18:45:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY), '20:01:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_bench_press, 1, 10, 35.00, TRUE, NULL),
(@s, @ex_barbell_bench_press, 2, 9, 70.00, FALSE, 9.0),
(@s, @ex_barbell_bench_press, 3, 8, 70.00, FALSE, 9.5),
(@s, @ex_barbell_bench_press, 4, 7, 70.00, FALSE, 9.0),
(@s, @ex_incline_dumbbell_press, 1, 10, 24.00, FALSE, 8.0),
(@s, @ex_incline_dumbbell_press, 2, 9, 24.00, FALSE, 9.5),
(@s, @ex_incline_dumbbell_press, 3, 8, 24.00, FALSE, 8.5),
(@s, @ex_dumbbell_lateral_raise, 1, 8, 12.50, FALSE, 8.5),
(@s, @ex_dumbbell_lateral_raise, 2, 7, 12.50, FALSE, 8.5),
(@s, @ex_dumbbell_lateral_raise, 3, 6, 12.50, FALSE, 9.5),
(@s, @ex_triceps_rope_pushdown, 1, 8, 27.50, FALSE, 9.0),
(@s, @ex_triceps_rope_pushdown, 2, 7, 27.50, FALSE, 9.5),
(@s, @ex_triceps_rope_pushdown, 3, 6, 27.50, FALSE, 9.5);

-- Pull, 28 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_pull, DATE_SUB(CURRENT_DATE, INTERVAL 28 DAY), 'Pull', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 28 DAY), '17:47:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 28 DAY), '18:56:00'), 'First week back on PPL, keeping it controlled.');
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_deadlift, 1, 10, 65.00, TRUE, NULL),
(@s, @ex_barbell_deadlift, 2, 6, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 3, 5, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 4, 4, 130.00, FALSE, 9.0),
(@s, @ex_lat_pulldown, 1, 10, 55.00, FALSE, 8.5),
(@s, @ex_lat_pulldown, 2, 9, 55.00, FALSE, 9.5),
(@s, @ex_lat_pulldown, 3, 8, 55.00, FALSE, 8.5),
(@s, @ex_seated_cable_row, 1, 8, 57.50, FALSE, 8.5),
(@s, @ex_seated_cable_row, 2, 7, 57.50, FALSE, 8.5),
(@s, @ex_seated_cable_row, 3, 6, 57.50, FALSE, 9.0),
(@s, @ex_hammer_curl, 1, 8, 16.50, FALSE, 8.5),
(@s, @ex_hammer_curl, 2, 7, 16.50, FALSE, 9.0),
(@s, @ex_hammer_curl, 3, 6, 16.50, FALSE, 9.0);

-- Legs, 27 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_legs, DATE_SUB(CURRENT_DATE, INTERVAL 27 DAY), 'Legs', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 27 DAY), '18:48:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 27 DAY), '19:50:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_back_squat, 1, 10, 50.00, TRUE, NULL),
(@s, @ex_barbell_back_squat, 2, 7, 100.00, FALSE, 8.0),
(@s, @ex_barbell_back_squat, 3, 6, 100.00, FALSE, 9.5),
(@s, @ex_barbell_back_squat, 4, 5, 100.00, FALSE, 8.5),
(@s, @ex_romanian_deadlift, 1, 8, 80.00, FALSE, 8.5),
(@s, @ex_romanian_deadlift, 2, 7, 80.00, FALSE, 8.5),
(@s, @ex_romanian_deadlift, 3, 6, 80.00, FALSE, 8.5),
(@s, @ex_leg_press, 1, 8, 162.50, FALSE, 8.0),
(@s, @ex_leg_press, 2, 7, 162.50, FALSE, 9.0),
(@s, @ex_leg_press, 3, 6, 162.50, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 1, 8, 62.50, FALSE, 8.0),
(@s, @ex_standing_calf_raise, 2, 7, 62.50, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 3, 6, 62.50, FALSE, 8.5);

-- Push, 25 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_push, DATE_SUB(CURRENT_DATE, INTERVAL 25 DAY), 'Push', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 25 DAY), '17:52:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 25 DAY), '19:00:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_bench_press, 1, 10, 35.00, TRUE, NULL),
(@s, @ex_barbell_bench_press, 2, 10, 70.00, FALSE, 8.5),
(@s, @ex_barbell_bench_press, 3, 9, 70.00, FALSE, 8.5),
(@s, @ex_barbell_bench_press, 4, 8, 70.00, FALSE, 8.5),
(@s, @ex_incline_dumbbell_press, 1, 8, 26.50, FALSE, 9.0),
(@s, @ex_incline_dumbbell_press, 2, 7, 26.50, FALSE, 9.0),
(@s, @ex_incline_dumbbell_press, 3, 6, 26.50, FALSE, 9.0),
(@s, @ex_dumbbell_lateral_raise, 1, 9, 12.50, FALSE, 8.5),
(@s, @ex_dumbbell_lateral_raise, 2, 8, 12.50, FALSE, 9.0),
(@s, @ex_dumbbell_lateral_raise, 3, 7, 12.50, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 1, 8, 27.50, FALSE, 8.0),
(@s, @ex_triceps_rope_pushdown, 2, 7, 27.50, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 3, 6, 27.50, FALSE, 9.0);

-- Pull, 23 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_pull, DATE_SUB(CURRENT_DATE, INTERVAL 23 DAY), 'Pull', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 23 DAY), '17:57:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 23 DAY), '19:15:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_deadlift, 1, 10, 65.00, TRUE, NULL),
(@s, @ex_barbell_deadlift, 2, 7, 130.00, FALSE, 8.0),
(@s, @ex_barbell_deadlift, 3, 6, 130.00, FALSE, 9.5),
(@s, @ex_barbell_deadlift, 4, 5, 130.00, FALSE, 9.5),
(@s, @ex_lat_pulldown, 1, 8, 57.50, FALSE, 9.0),
(@s, @ex_lat_pulldown, 2, 7, 57.50, FALSE, 8.5),
(@s, @ex_lat_pulldown, 3, 6, 57.50, FALSE, 9.5),
(@s, @ex_seated_cable_row, 1, 9, 57.50, FALSE, 9.0),
(@s, @ex_seated_cable_row, 2, 8, 57.50, FALSE, 8.5),
(@s, @ex_seated_cable_row, 3, 7, 57.50, FALSE, 8.5),
(@s, @ex_hammer_curl, 1, 9, 16.50, FALSE, 9.0),
(@s, @ex_hammer_curl, 2, 8, 16.50, FALSE, 9.5),
(@s, @ex_hammer_curl, 3, 7, 16.50, FALSE, 9.0);

-- Legs, 21 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_legs, DATE_SUB(CURRENT_DATE, INTERVAL 21 DAY), 'Legs', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 21 DAY), '18:44:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 21 DAY), '19:51:00'), 'Short on sleep, kept the back-off sets tight.');
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_back_squat, 1, 10, 50.00, TRUE, NULL),
(@s, @ex_barbell_back_squat, 2, 8, 100.00, FALSE, 9.0),
(@s, @ex_barbell_back_squat, 3, 7, 100.00, FALSE, 9.0),
(@s, @ex_barbell_back_squat, 4, 6, 100.00, FALSE, 8.5),
(@s, @ex_romanian_deadlift, 1, 8, 80.00, FALSE, 8.0),
(@s, @ex_romanian_deadlift, 2, 7, 80.00, FALSE, 9.5),
(@s, @ex_romanian_deadlift, 3, 6, 80.00, FALSE, 8.5),
(@s, @ex_leg_press, 1, 8, 162.50, FALSE, 8.5),
(@s, @ex_leg_press, 2, 7, 162.50, FALSE, 9.0),
(@s, @ex_leg_press, 3, 6, 162.50, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 1, 9, 62.50, FALSE, 8.0),
(@s, @ex_standing_calf_raise, 2, 8, 62.50, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 3, 7, 62.50, FALSE, 8.5);

-- Push, 20 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_push, DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY), 'Push', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY), '18:30:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY), '19:30:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_bench_press, 1, 10, 37.50, TRUE, NULL),
(@s, @ex_barbell_bench_press, 2, 8, 72.50, FALSE, 9.0),
(@s, @ex_barbell_bench_press, 3, 7, 72.50, FALSE, 9.0),
(@s, @ex_barbell_bench_press, 4, 6, 72.50, FALSE, 8.5),
(@s, @ex_incline_dumbbell_press, 1, 9, 26.50, FALSE, 8.5),
(@s, @ex_incline_dumbbell_press, 2, 8, 26.50, FALSE, 9.0),
(@s, @ex_incline_dumbbell_press, 3, 7, 26.50, FALSE, 8.5),
(@s, @ex_dumbbell_lateral_raise, 1, 9, 12.50, FALSE, 8.5),
(@s, @ex_dumbbell_lateral_raise, 2, 8, 12.50, FALSE, 9.5),
(@s, @ex_dumbbell_lateral_raise, 3, 7, 12.50, FALSE, 9.0),
(@s, @ex_triceps_rope_pushdown, 1, 9, 27.50, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 2, 8, 27.50, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 3, 7, 27.50, FALSE, 9.5);

-- Pull, 18 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_pull, DATE_SUB(CURRENT_DATE, INTERVAL 18 DAY), 'Pull', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 18 DAY), '18:09:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 18 DAY), '19:28:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_deadlift, 1, 10, 65.00, TRUE, NULL),
(@s, @ex_barbell_deadlift, 2, 8, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 3, 7, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 4, 6, 130.00, FALSE, 8.5),
(@s, @ex_lat_pulldown, 1, 9, 57.50, FALSE, 8.0),
(@s, @ex_lat_pulldown, 2, 8, 57.50, FALSE, 9.0),
(@s, @ex_lat_pulldown, 3, 7, 57.50, FALSE, 8.5),
(@s, @ex_seated_cable_row, 1, 10, 57.50, FALSE, 8.0),
(@s, @ex_seated_cable_row, 2, 9, 57.50, FALSE, 9.5),
(@s, @ex_seated_cable_row, 3, 8, 57.50, FALSE, 8.5),
(@s, @ex_hammer_curl, 1, 10, 16.50, FALSE, 8.0),
(@s, @ex_hammer_curl, 2, 9, 16.50, FALSE, 9.0),
(@s, @ex_hammer_curl, 3, 8, 16.50, FALSE, 9.0);

-- Legs, 16 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_legs, DATE_SUB(CURRENT_DATE, INTERVAL 16 DAY), 'Legs', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 16 DAY), '18:51:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 16 DAY), '20:07:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_back_squat, 1, 10, 50.00, TRUE, NULL),
(@s, @ex_barbell_back_squat, 2, 9, 100.00, FALSE, 9.0),
(@s, @ex_barbell_back_squat, 3, 8, 100.00, FALSE, 8.5),
(@s, @ex_barbell_back_squat, 4, 7, 100.00, FALSE, 8.5),
(@s, @ex_romanian_deadlift, 1, 9, 80.00, FALSE, 8.0),
(@s, @ex_romanian_deadlift, 2, 8, 80.00, FALSE, 9.0),
(@s, @ex_romanian_deadlift, 3, 7, 80.00, FALSE, 9.0),
(@s, @ex_leg_press, 1, 9, 162.50, FALSE, 8.5),
(@s, @ex_leg_press, 2, 8, 162.50, FALSE, 9.0),
(@s, @ex_leg_press, 3, 7, 162.50, FALSE, 9.0),
(@s, @ex_standing_calf_raise, 1, 10, 62.50, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 2, 9, 62.50, FALSE, 9.5),
(@s, @ex_standing_calf_raise, 3, 8, 62.50, FALSE, 8.5);

-- Push, 14 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_push, DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY), 'Push', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY), '18:47:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY), '19:56:00'), 'Bench moving fast today.');
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_bench_press, 1, 10, 37.50, TRUE, NULL),
(@s, @ex_barbell_bench_press, 2, 9, 72.50, FALSE, 8.5),
(@s, @ex_barbell_bench_press, 3, 8, 72.50, FALSE, 8.5),
(@s, @ex_barbell_bench_press, 4, 7, 72.50, FALSE, 9.5),
(@s, @ex_incline_dumbbell_press, 1, 10, 26.50, FALSE, 8.0),
(@s, @ex_incline_dumbbell_press, 2, 9, 26.50, FALSE, 9.0),
(@s, @ex_incline_dumbbell_press, 3, 8, 26.50, FALSE, 9.5),
(@s, @ex_dumbbell_lateral_raise, 1, 10, 12.50, FALSE, 9.0),
(@s, @ex_dumbbell_lateral_raise, 2, 9, 12.50, FALSE, 9.0),
(@s, @ex_dumbbell_lateral_raise, 3, 8, 12.50, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 1, 10, 27.50, FALSE, 9.0),
(@s, @ex_triceps_rope_pushdown, 2, 9, 27.50, FALSE, 9.5),
(@s, @ex_triceps_rope_pushdown, 3, 8, 27.50, FALSE, 9.0);

-- Pull, 13 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_pull, DATE_SUB(CURRENT_DATE, INTERVAL 13 DAY), 'Pull', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 13 DAY), '18:31:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 13 DAY), '19:34:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_deadlift, 1, 10, 65.00, TRUE, NULL),
(@s, @ex_barbell_deadlift, 2, 9, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 3, 8, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 4, 7, 130.00, FALSE, 8.5),
(@s, @ex_lat_pulldown, 1, 9, 57.50, FALSE, 8.0),
(@s, @ex_lat_pulldown, 2, 8, 57.50, FALSE, 8.5),
(@s, @ex_lat_pulldown, 3, 7, 57.50, FALSE, 9.0),
(@s, @ex_seated_cable_row, 1, 10, 57.50, FALSE, 8.0),
(@s, @ex_seated_cable_row, 2, 9, 57.50, FALSE, 9.5),
(@s, @ex_seated_cable_row, 3, 8, 57.50, FALSE, 9.5),
(@s, @ex_hammer_curl, 1, 8, 19.00, FALSE, 8.0),
(@s, @ex_hammer_curl, 2, 7, 19.00, FALSE, 9.0),
(@s, @ex_hammer_curl, 3, 6, 19.00, FALSE, 9.0);

-- Legs, 11 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_legs, DATE_SUB(CURRENT_DATE, INTERVAL 11 DAY), 'Legs', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 11 DAY), '18:17:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 11 DAY), '19:13:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_back_squat, 1, 10, 50.00, TRUE, NULL),
(@s, @ex_barbell_back_squat, 2, 10, 100.00, FALSE, 8.0),
(@s, @ex_barbell_back_squat, 3, 9, 100.00, FALSE, 8.5),
(@s, @ex_barbell_back_squat, 4, 8, 100.00, FALSE, 9.5),
(@s, @ex_romanian_deadlift, 1, 10, 80.00, FALSE, 8.0),
(@s, @ex_romanian_deadlift, 2, 9, 80.00, FALSE, 9.5),
(@s, @ex_romanian_deadlift, 3, 8, 80.00, FALSE, 9.0),
(@s, @ex_leg_press, 1, 10, 162.50, FALSE, 8.0),
(@s, @ex_leg_press, 2, 9, 162.50, FALSE, 8.5),
(@s, @ex_leg_press, 3, 8, 162.50, FALSE, 9.0),
(@s, @ex_standing_calf_raise, 1, 8, 65.00, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 2, 7, 65.00, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 3, 6, 65.00, FALSE, 9.0);

-- Push, 9 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_push, DATE_SUB(CURRENT_DATE, INTERVAL 9 DAY), 'Push', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 9 DAY), '18:15:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 9 DAY), '19:34:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_bench_press, 1, 10, 37.50, TRUE, NULL),
(@s, @ex_barbell_bench_press, 2, 10, 72.50, FALSE, 8.0),
(@s, @ex_barbell_bench_press, 3, 9, 72.50, FALSE, 9.0),
(@s, @ex_barbell_bench_press, 4, 8, 72.50, FALSE, 9.5),
(@s, @ex_incline_dumbbell_press, 1, 8, 29.00, FALSE, 8.0),
(@s, @ex_incline_dumbbell_press, 2, 7, 29.00, FALSE, 9.0),
(@s, @ex_incline_dumbbell_press, 3, 6, 29.00, FALSE, 9.0),
(@s, @ex_dumbbell_lateral_raise, 1, 8, 15.00, FALSE, 8.0),
(@s, @ex_dumbbell_lateral_raise, 2, 7, 15.00, FALSE, 9.5),
(@s, @ex_dumbbell_lateral_raise, 3, 6, 15.00, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 1, 10, 27.50, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 2, 9, 27.50, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 3, 8, 27.50, FALSE, 8.5);

-- Pull, 6 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_pull, DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY), 'Pull', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY), '18:05:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY), '19:03:00'), 'Deadlift felt smooth, grip was the limit.');
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_deadlift, 1, 10, 65.00, TRUE, NULL),
(@s, @ex_barbell_deadlift, 2, 10, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 3, 9, 130.00, FALSE, 9.0),
(@s, @ex_barbell_deadlift, 4, 8, 130.00, FALSE, 9.0),
(@s, @ex_lat_pulldown, 1, 10, 57.50, FALSE, 8.0),
(@s, @ex_lat_pulldown, 2, 9, 57.50, FALSE, 8.5),
(@s, @ex_lat_pulldown, 3, 8, 57.50, FALSE, 9.0),
(@s, @ex_seated_cable_row, 1, 8, 60.00, FALSE, 8.0),
(@s, @ex_seated_cable_row, 2, 7, 60.00, FALSE, 9.5),
(@s, @ex_seated_cable_row, 3, 6, 60.00, FALSE, 9.0),
(@s, @ex_hammer_curl, 1, 9, 19.00, FALSE, 9.0),
(@s, @ex_hammer_curl, 2, 8, 19.00, FALSE, 9.0),
(@s, @ex_hammer_curl, 3, 7, 19.00, FALSE, 9.0);

-- Legs, 3 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_legs, DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), 'Legs', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), '18:11:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), '19:18:00'), 'Squat depth on point, legs cooked.');
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_back_squat, 1, 10, 52.50, TRUE, NULL),
(@s, @ex_barbell_back_squat, 2, 8, 102.50, FALSE, 8.0),
(@s, @ex_barbell_back_squat, 3, 7, 102.50, FALSE, 9.0),
(@s, @ex_barbell_back_squat, 4, 6, 102.50, FALSE, 9.5),
(@s, @ex_romanian_deadlift, 1, 8, 82.50, FALSE, 8.5),
(@s, @ex_romanian_deadlift, 2, 7, 82.50, FALSE, 9.5),
(@s, @ex_romanian_deadlift, 3, 6, 82.50, FALSE, 9.5),
(@s, @ex_leg_press, 1, 8, 165.00, FALSE, 9.0),
(@s, @ex_leg_press, 2, 7, 165.00, FALSE, 9.5),
(@s, @ex_leg_press, 3, 6, 165.00, FALSE, 8.5),
(@s, @ex_standing_calf_raise, 1, 9, 65.00, FALSE, 9.0),
(@s, @ex_standing_calf_raise, 2, 8, 65.00, FALSE, 9.0),
(@s, @ex_standing_calf_raise, 3, 7, 65.00, FALSE, 8.5);

-- Push, 1 day(s) ago
INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES
(@alex, @day_push, DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), 'Push', TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), '17:39:00'), TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), '18:59:00'), NULL);
SET @s = LAST_INSERT_ID();
INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES
(@s, @ex_barbell_bench_press, 1, 10, 37.50, TRUE, NULL),
(@s, @ex_barbell_bench_press, 2, 8, 75.00, FALSE, 8.0),
(@s, @ex_barbell_bench_press, 3, 7, 75.00, FALSE, 9.0),
(@s, @ex_barbell_bench_press, 4, 6, 75.00, FALSE, 9.0),
(@s, @ex_incline_dumbbell_press, 1, 8, 29.00, FALSE, 8.5),
(@s, @ex_incline_dumbbell_press, 2, 7, 29.00, FALSE, 8.5),
(@s, @ex_incline_dumbbell_press, 3, 6, 29.00, FALSE, 9.0),
(@s, @ex_dumbbell_lateral_raise, 1, 9, 15.00, FALSE, 8.5),
(@s, @ex_dumbbell_lateral_raise, 2, 8, 15.00, FALSE, 8.5),
(@s, @ex_dumbbell_lateral_raise, 3, 7, 15.00, FALSE, 9.5),
(@s, @ex_triceps_rope_pushdown, 1, 8, 30.00, FALSE, 9.0),
(@s, @ex_triceps_rope_pushdown, 2, 7, 30.00, FALSE, 8.5),
(@s, @ex_triceps_rope_pushdown, 3, 6, 30.00, FALSE, 9.5);

-- Weekly body measurements (lean bulk)
INSERT INTO body_measurements (user_id, recorded_on, weight, waist, chest, arms) VALUES
(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 35 DAY), 76.00, 81.00, 100.00, 37.00),
(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 28 DAY), 76.30, 81.00, 100.40, 37.20),
(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 21 DAY), 76.40, 81.20, 100.60, 37.30),
(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY), 76.80, 81.30, 101.00, 37.50),
(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY), 77.00, 81.40, 101.20, 37.60),
(@alex, CURRENT_DATE, 77.20, 81.50, 101.50, 37.80);

-- Daily fuel for the last week (targets computed by sp_ensure_daily_fuel)
CALL sp_ensure_daily_fuel(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY));
UPDATE user_daily_fuel SET protein_logged_g = ROUND(protein_target_g * 1.03), water_logged_ml = ROUND(water_target_ml * 0.74 / 250) * 250 WHERE user_id = @alex AND fuel_date = DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY);
CALL sp_ensure_daily_fuel(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY));
UPDATE user_daily_fuel SET protein_logged_g = ROUND(protein_target_g * 1.06), water_logged_ml = ROUND(water_target_ml * 0.98 / 250) * 250 WHERE user_id = @alex AND fuel_date = DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY);
CALL sp_ensure_daily_fuel(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 4 DAY));
UPDATE user_daily_fuel SET protein_logged_g = ROUND(protein_target_g * 0.74), water_logged_ml = ROUND(water_target_ml * 1.08 / 250) * 250 WHERE user_id = @alex AND fuel_date = DATE_SUB(CURRENT_DATE, INTERVAL 4 DAY);
CALL sp_ensure_daily_fuel(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY));
UPDATE user_daily_fuel SET protein_logged_g = ROUND(protein_target_g * 0.80), water_logged_ml = ROUND(water_target_ml * 1.04 / 250) * 250 WHERE user_id = @alex AND fuel_date = DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY);
CALL sp_ensure_daily_fuel(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY));
UPDATE user_daily_fuel SET protein_logged_g = ROUND(protein_target_g * 1.01), water_logged_ml = ROUND(water_target_ml * 0.75 / 250) * 250 WHERE user_id = @alex AND fuel_date = DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY);
CALL sp_ensure_daily_fuel(@alex, DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY));
UPDATE user_daily_fuel SET protein_logged_g = ROUND(protein_target_g * 0.96), water_logged_ml = ROUND(water_target_ml * 0.93 / 250) * 250 WHERE user_id = @alex AND fuel_date = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY);
CALL sp_ensure_daily_fuel(@alex, CURRENT_DATE);
UPDATE user_daily_fuel SET protein_logged_g = ROUND(protein_target_g * 0.45), water_logged_ml = ROUND(water_target_ml * 0.40 / 250) * 250 WHERE user_id = @alex AND fuel_date = CURRENT_DATE;
