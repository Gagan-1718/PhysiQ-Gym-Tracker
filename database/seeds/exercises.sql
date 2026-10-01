-- =============================================================================
-- Seed Data: Exercises Master Library
-- =============================================================================

USE physiq_db;

INSERT INTO exercises (name, muscle_group, equipment_needed, instructions) VALUES
-- Chest
('Barbell Bench Press', 'Chest', 'Barbell', 'Lie on flat bench, grip barbell slightly wider than shoulder width, lower to mid-chest, press up.'),
('Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Set bench to 30-45 degrees, press dumbbells upward over upper chest.'),
('Cable Chest Fly', 'Chest', 'Cable', 'Stand in center of cable crossover, bring handles together in hugging arc motion.'),
('Dips (Chest Focus)', 'Chest', 'Bodyweight', 'Lean torso slightly forward, lower body until upper arms are parallel to floor.'),
('Push-Up', 'Chest', 'Bodyweight', 'Standard push-up keeping core braced and elbows at 45 degree angle.'),

-- Back
('Barbell Deadlift', 'Back', 'Barbell', 'Stand hip-width, grip bar outside knees, drive through floor keeping neutral spine.'),
('Lat Pulldown', 'Back', 'Cable', 'Grip wide bar, pull down towards upper chest while engaging lats and retracting scapula.'),
('Barbell Bent-Over Row', 'Back', 'Barbell', 'Hinge at hips to 45 degrees, pull barbell towards belly button.'),
('Seated Cable Row', 'Back', 'Cable', 'Sit upright with neutral spine, pull attachment to lower abdomen.'),
('Pull-Up', 'Back', 'Bodyweight', 'Overhand grip on pull-up bar, pull chest to bar with strict form.'),

-- Shoulders
('Overhead Barbell Press', 'Shoulders', 'Barbell', 'Stand upright, press barbell from collarbone to full overhead lockout.'),
('Dumbbell Lateral Raise', 'Shoulders', 'Dumbbell', 'Raise dumbbells to sides up to shoulder height leading with elbows.'),
('Rear Delt Fly (Machine)', 'Shoulders', 'Machine', 'Sit facing machine, pull handles backward squeezing posterior deltoids.'),
('Dumbbell Arnold Press', 'Shoulders', 'Dumbbell', 'Rotate wrists while pressing dumbbells overhead.'),

-- Legs (Quads / Hamstrings / Calves / Glutes)
('Barbell Back Squat', 'Quads', 'Barbell', 'Barbell on upper traps, squat down until thighs are parallel or below.'),
('Leg Press', 'Quads', 'Machine', 'Place feet shoulder-width on platform, lower sled with control and press.'),
('Romanian Deadlift', 'Hamstrings', 'Barbell', 'Hinge at hips with slight knee bend, lowering bar along shins.'),
('Leg Curl (Seated/Lying)', 'Hamstrings', 'Machine', 'Curl legs toward glutes against pad resistance.'),
('Standing Calf Raise', 'Calves', 'Machine', 'Drive through balls of feet for full contraction at top of calf raise.'),
('Bulgarian Split Squat', 'Quads', 'Dumbbell', 'Rear foot elevated on bench, squat down with front leg.'),

-- Arms (Biceps / Triceps)
('Barbell Bicep Curl', 'Biceps', 'Barbell', 'Stand upright, curl barbell towards shoulders while keeping elbows stationary.'),
('Incline Dumbbell Curl', 'Biceps', 'Dumbbell', 'Lie on incline bench, curl dumbbells with full stretch at the bottom.'),
('Hammer Curl', 'Biceps', 'Dumbbell', 'Neutral grip dumbbell curl targeting brachialis and forearms.'),
('Skull Crushers (EZ Bar)', 'Triceps', 'Barbell', 'Lie on bench, lower EZ bar towards forehead, extend elbows to lockout.'),
('Triceps Rope Pushdown', 'Triceps', 'Cable', 'Push cable rope down and flare outward at bottom contraction.'),

-- Core
('Hanging Leg Raise', 'Core', 'Bodyweight', 'Hang from pull-up bar, lift straight legs to 90 degrees using abdominal control.'),
('Cable Woodchoppers', 'Core', 'Cable', 'Rotate torso diagonally across body against cable resistance.'),
('Plank', 'Core', 'Bodyweight', 'Hold rigid push-up/forearm position keeping spine neutral.');
