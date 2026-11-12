-- =============================================================================
-- Seed: muscle groups + master exercise library (44 movements)
-- =============================================================================

USE physiq_db;

INSERT INTO muscle_groups (name, region) VALUES
('Chest', 'upper'),
('Back', 'upper'),
('Shoulders', 'upper'),
('Biceps', 'upper'),
('Triceps', 'upper'),
('Quads', 'lower'),
('Hamstrings', 'lower'),
('Glutes', 'lower'),
('Calves', 'lower'),
('Core', 'core');

SET @chest      = (SELECT id FROM muscle_groups WHERE name = 'Chest');
SET @back       = (SELECT id FROM muscle_groups WHERE name = 'Back');
SET @shoulders  = (SELECT id FROM muscle_groups WHERE name = 'Shoulders');
SET @biceps     = (SELECT id FROM muscle_groups WHERE name = 'Biceps');
SET @triceps    = (SELECT id FROM muscle_groups WHERE name = 'Triceps');
SET @quads      = (SELECT id FROM muscle_groups WHERE name = 'Quads');
SET @hamstrings = (SELECT id FROM muscle_groups WHERE name = 'Hamstrings');
SET @glutes     = (SELECT id FROM muscle_groups WHERE name = 'Glutes');
SET @calves     = (SELECT id FROM muscle_groups WHERE name = 'Calves');
SET @core       = (SELECT id FROM muscle_groups WHERE name = 'Core');

-- Body-map regions (migration 003): finer than muscle groups, each belongs to one
INSERT INTO muscle_regions (code, label, body_view, muscle_group_id) VALUES
('chest',       'Chest',       'front', @chest),
('front_delts', 'Front delts', 'front', @shoulders),
('side_delts',  'Side delts',  'front', @shoulders),
('rear_delts',  'Rear delts',  'back',  @shoulders),
('biceps',      'Biceps',      'front', @biceps),
('triceps',     'Triceps',     'back',  @triceps),
('lats',        'Lats',        'back',  @back),
('traps',       'Traps',       'back',  @back),
('lower_back',  'Lower back',  'back',  @back),
('abs',         'Abs',         'front', @core),
('obliques',    'Obliques',    'front', @core),
('quads',       'Quads',       'front', @quads),
('hamstrings',  'Hamstrings',  'back',  @hamstrings),
('glutes',      'Glutes',      'back',  @glutes),
('calves',      'Calves',      'back',  @calves);

INSERT INTO exercises (name, muscle_group_id, equipment_needed, instructions, media_key, weight_step_kg, start_bw_ratio) VALUES
-- Chest
('Barbell Bench Press',            @chest, 'Barbell',    'Lie on a flat bench, grip slightly wider than shoulders, lower to mid-chest, press up.', 'barbell-bench-press', 5.0, 0.400),
('Incline Barbell Bench Press',    @chest, 'Barbell',    'Bench at 30 degrees, lower the bar to the upper chest, press up and slightly back.', 'incline-barbell-bench-press', 5.0, 0.350),
('Incline Dumbbell Press',         @chest, 'Dumbbell',   'Bench at 30-45 degrees, press the dumbbells up over the upper chest.', 'incline-dumbbell-press', 2.5, 0.140),
('Machine Chest Press',            @chest, 'Machine',    'Set the handles at mid-chest height, press forward without locking the elbows hard.', 'machine-chest-press', 5.0, 0.400),
('Cable Chest Fly',                @chest, 'Cable',      'Stand between the stacks and bring the handles together in a wide hugging arc.', 'cable-chest-fly', 2.5, 0.100),
('Dips (Chest Focus)',             @chest, 'Bodyweight', 'Lean the torso forward and lower until the upper arms are parallel to the floor.', 'dips-chest', 0.0, NULL),
('Push-Up',                        @chest, 'Bodyweight', 'Brace the core, elbows at about 45 degrees, chest to just above the floor.', 'push-up', 0.0, NULL),
-- Back
('Barbell Deadlift',               @back, 'Barbell',    'Hip-width stance, grip outside the knees, push the floor away with a neutral spine.', 'barbell-deadlift', 10.0, 0.600),
('Lat Pulldown',                   @back, 'Cable',      'Wide grip, pull the bar to the upper chest while driving the elbows down.', 'lat-pulldown', 5.0, 0.450),
('Barbell Bent-Over Row',          @back, 'Barbell',    'Hinge to about 45 degrees and row the bar to the belly button.', 'barbell-bent-over-row', 5.0, 0.400),
('Seated Cable Row',               @back, 'Cable',      'Sit tall with a neutral spine and pull the handle to the lower abdomen.', 'seated-cable-row', 5.0, 0.450),
('Pull-Up',                        @back, 'Bodyweight', 'Overhand grip, pull the chest towards the bar with no kipping.', 'pull-up', 0.0, NULL),
('One-Arm Dumbbell Row',           @back, 'Dumbbell',   'Knee and hand on the bench, row the dumbbell to the hip.', 'one-arm-dumbbell-row', 2.5, 0.200),
('Chest-Supported T-Bar Row',      @back, 'Machine',    'Chest on the pad, row the handles while squeezing the shoulder blades.', 'chest-supported-t-bar-row', 5.0, 0.300),
-- Shoulders
('Overhead Barbell Press',         @shoulders, 'Barbell',  'Standing, press the bar from the collarbone to straight overhead.', 'overhead-barbell-press', 5.0, 0.300),
('Seated Dumbbell Shoulder Press', @shoulders, 'Dumbbell', 'Back supported, press the dumbbells from ear height to overhead.', 'seated-dumbbell-shoulder-press', 2.5, 0.120),
('Dumbbell Lateral Raise',         @shoulders, 'Dumbbell', 'Raise the dumbbells out to the sides up to shoulder height, slight elbow bend.', 'dumbbell-lateral-raise', 2.5, 0.050),
('Cable Lateral Raise',            @shoulders, 'Cable',    'Cable at hip height, raise the arm out to the side across the body.', 'cable-lateral-raise', 2.5, 0.040),
('Rear Delt Fly (Machine)',        @shoulders, 'Machine',  'Face the pad and sweep the handles back with straight arms.', 'rear-delt-fly-machine', 5.0, 0.200),
('Face Pull',                      @shoulders, 'Cable',    'Rope at face height, pull towards the forehead with elbows high.', 'face-pull', 2.5, 0.200),
('Dumbbell Arnold Press',          @shoulders, 'Dumbbell', 'Rotate the wrists from palms-in to palms-out while pressing up.', 'dumbbell-arnold-press', 2.5, 0.100),
-- Biceps
('Barbell Bicep Curl',             @biceps, 'Barbell',  'Stand tall, elbows pinned to the sides, curl the bar to the shoulders.', 'barbell-bicep-curl', 2.5, 0.200),
('Incline Dumbbell Curl',          @biceps, 'Dumbbell', 'Lie back on an incline bench, arms hanging, curl without moving the elbows.', 'incline-dumbbell-curl', 2.5, 0.080),
('Hammer Curl',                    @biceps, 'Dumbbell', 'Neutral grip, curl the dumbbells while keeping the wrists straight.', 'hammer-curl', 2.5, 0.100),
('Dumbbell Bicep Curl',            @biceps, 'Dumbbell', 'Palms up, elbows pinned to the sides, curl both dumbbells to the shoulders and lower slowly.', 'dumbbell-bicep-curl', 2.5, 0.100),
('Preacher Curl',                  @biceps, 'Machine',  'Upper arms on the pad, curl up and lower under control.', 'preacher-curl', 2.5, 0.180),
('Cable Curl',                     @biceps, 'Cable',    'Straight bar on a low pulley, curl with elbows fixed at the sides.', 'cable-curl', 2.5, 0.200),
-- Triceps
('Skull Crushers (EZ Bar)',        @triceps, 'Barbell', 'Lie on a bench and lower the EZ bar towards the forehead by bending the elbows.', 'skull-crushers', 2.5, 0.200),
('Triceps Rope Pushdown',          @triceps, 'Cable',   'Push the rope down and split the ends apart at the bottom.', 'triceps-rope-pushdown', 2.5, 0.200),
('Overhead Cable Triceps Extension', @triceps, 'Cable', 'Facing away from the stack, extend the rope overhead from behind the head.', 'overhead-cable-triceps-extension', 2.5, 0.180),
('Close-Grip Bench Press',         @triceps, 'Barbell', 'Shoulder-width grip, elbows tucked, lower to the lower chest and press.', 'close-grip-bench-press', 5.0, 0.350),
-- Quads
('Barbell Back Squat',             @quads, 'Barbell',  'Bar on the upper back, sit down between the hips to at least parallel.', 'barbell-back-squat', 10.0, 0.500),
('Leg Press',                      @quads, 'Machine',  'Feet shoulder-width on the platform, lower until the knees reach about 90 degrees.', 'leg-press', 10.0, 1.000),
('Hack Squat',                     @quads, 'Machine',  'Shoulders under the pads, squat deep while keeping the back on the pad.', 'hack-squat', 10.0, 0.500),
('Leg Extension',                  @quads, 'Machine',  'Extend the knees fully and squeeze the quads at the top.', 'leg-extension', 5.0, 0.350),
('Bulgarian Split Squat',          @quads, 'Dumbbell', 'Rear foot on a bench, lower straight down on the front leg.', 'bulgarian-split-squat', 2.5, 0.100),
-- Hamstrings
('Romanian Deadlift',              @hamstrings, 'Barbell', 'Soft knees, hinge at the hips sliding the bar down the thighs to a deep stretch.', 'romanian-deadlift', 10.0, 0.500),
('Leg Curl (Seated/Lying)',        @hamstrings, 'Machine', 'Curl the pad towards the glutes and control the way back.', 'leg-curl', 5.0, 0.300),
-- Glutes
('Barbell Hip Thrust',             @glutes, 'Barbell', 'Upper back on a bench, drive the hips up until the torso is level.', 'barbell-hip-thrust', 10.0, 0.600),
('Cable Glute Kickback',           @glutes, 'Cable',   'Ankle strap on, kick the leg back while keeping the hips square.', 'cable-glute-kickback', 2.5, 0.080),
-- Calves
('Standing Calf Raise',            @calves, 'Machine', 'Rise onto the toes as high as possible, pause, lower to a full stretch.', 'standing-calf-raise', 10.0, 0.600),
('Seated Calf Raise',              @calves, 'Machine', 'Knees under the pad, raise the heels and pause at the top.', 'seated-calf-raise', 5.0, 0.400),
-- Core
('Hanging Leg Raise',              @core, 'Bodyweight', 'Hang from a bar and raise the legs to hip height without swinging.', 'hanging-leg-raise', 0.0, NULL),
('Cable Crunch',                   @core, 'Cable',      'Kneel with the rope at the head, crunch the ribs towards the hips.', 'cable-crunch', 5.0, 0.300),
('Ab Wheel Rollout',               @core, 'Other',      'From the knees, roll out as far as you can while keeping the lower back flat.', 'ab-wheel-rollout', 0.0, NULL);

-- -----------------------------------------------------------------------------
-- Muscles each exercise works (migration 003): primary = the target muscle,
-- secondary = muscles that assist. Drives the red body map in the guided workout.
-- -----------------------------------------------------------------------------
INSERT INTO exercise_muscles (exercise_id, region_code, role)
SELECT e.id, m.region_code, m.role
FROM exercises e
JOIN (
    SELECT 'Barbell Bench Press'              AS name, 'chest'       AS region_code, 'primary' AS role
    UNION ALL SELECT 'Barbell Bench Press', 'front_delts', 'secondary'
    UNION ALL SELECT 'Barbell Bench Press', 'triceps', 'secondary'
    UNION ALL SELECT 'Incline Barbell Bench Press', 'chest', 'primary'
    UNION ALL SELECT 'Incline Barbell Bench Press', 'front_delts', 'secondary'
    UNION ALL SELECT 'Incline Barbell Bench Press', 'triceps', 'secondary'
    UNION ALL SELECT 'Incline Dumbbell Press', 'chest', 'primary'
    UNION ALL SELECT 'Incline Dumbbell Press', 'front_delts', 'secondary'
    UNION ALL SELECT 'Incline Dumbbell Press', 'triceps', 'secondary'
    UNION ALL SELECT 'Machine Chest Press', 'chest', 'primary'
    UNION ALL SELECT 'Machine Chest Press', 'front_delts', 'secondary'
    UNION ALL SELECT 'Machine Chest Press', 'triceps', 'secondary'
    UNION ALL SELECT 'Cable Chest Fly', 'chest', 'primary'
    UNION ALL SELECT 'Cable Chest Fly', 'front_delts', 'secondary'
    UNION ALL SELECT 'Dips (Chest Focus)', 'chest', 'primary'
    UNION ALL SELECT 'Dips (Chest Focus)', 'triceps', 'secondary'
    UNION ALL SELECT 'Dips (Chest Focus)', 'front_delts', 'secondary'
    UNION ALL SELECT 'Push-Up', 'chest', 'primary'
    UNION ALL SELECT 'Push-Up', 'triceps', 'secondary'
    UNION ALL SELECT 'Push-Up', 'front_delts', 'secondary'
    UNION ALL SELECT 'Push-Up', 'abs', 'secondary'
    UNION ALL SELECT 'Barbell Deadlift', 'lower_back', 'primary'
    UNION ALL SELECT 'Barbell Deadlift', 'glutes', 'primary'
    UNION ALL SELECT 'Barbell Deadlift', 'hamstrings', 'primary'
    UNION ALL SELECT 'Barbell Deadlift', 'traps', 'secondary'
    UNION ALL SELECT 'Barbell Deadlift', 'lats', 'secondary'
    UNION ALL SELECT 'Barbell Deadlift', 'quads', 'secondary'
    UNION ALL SELECT 'Lat Pulldown', 'lats', 'primary'
    UNION ALL SELECT 'Lat Pulldown', 'biceps', 'secondary'
    UNION ALL SELECT 'Lat Pulldown', 'rear_delts', 'secondary'
    UNION ALL SELECT 'Barbell Bent-Over Row', 'lats', 'primary'
    UNION ALL SELECT 'Barbell Bent-Over Row', 'traps', 'secondary'
    UNION ALL SELECT 'Barbell Bent-Over Row', 'rear_delts', 'secondary'
    UNION ALL SELECT 'Barbell Bent-Over Row', 'biceps', 'secondary'
    UNION ALL SELECT 'Barbell Bent-Over Row', 'lower_back', 'secondary'
    UNION ALL SELECT 'Seated Cable Row', 'lats', 'primary'
    UNION ALL SELECT 'Seated Cable Row', 'traps', 'secondary'
    UNION ALL SELECT 'Seated Cable Row', 'rear_delts', 'secondary'
    UNION ALL SELECT 'Seated Cable Row', 'biceps', 'secondary'
    UNION ALL SELECT 'Pull-Up', 'lats', 'primary'
    UNION ALL SELECT 'Pull-Up', 'biceps', 'secondary'
    UNION ALL SELECT 'Pull-Up', 'rear_delts', 'secondary'
    UNION ALL SELECT 'One-Arm Dumbbell Row', 'lats', 'primary'
    UNION ALL SELECT 'One-Arm Dumbbell Row', 'traps', 'secondary'
    UNION ALL SELECT 'One-Arm Dumbbell Row', 'rear_delts', 'secondary'
    UNION ALL SELECT 'One-Arm Dumbbell Row', 'biceps', 'secondary'
    UNION ALL SELECT 'Chest-Supported T-Bar Row', 'lats', 'primary'
    UNION ALL SELECT 'Chest-Supported T-Bar Row', 'traps', 'primary'
    UNION ALL SELECT 'Chest-Supported T-Bar Row', 'rear_delts', 'secondary'
    UNION ALL SELECT 'Chest-Supported T-Bar Row', 'biceps', 'secondary'
    UNION ALL SELECT 'Overhead Barbell Press', 'front_delts', 'primary'
    UNION ALL SELECT 'Overhead Barbell Press', 'side_delts', 'secondary'
    UNION ALL SELECT 'Overhead Barbell Press', 'triceps', 'secondary'
    UNION ALL SELECT 'Overhead Barbell Press', 'traps', 'secondary'
    UNION ALL SELECT 'Seated Dumbbell Shoulder Press', 'front_delts', 'primary'
    UNION ALL SELECT 'Seated Dumbbell Shoulder Press', 'side_delts', 'secondary'
    UNION ALL SELECT 'Seated Dumbbell Shoulder Press', 'triceps', 'secondary'
    UNION ALL SELECT 'Dumbbell Lateral Raise', 'side_delts', 'primary'
    UNION ALL SELECT 'Dumbbell Lateral Raise', 'traps', 'secondary'
    UNION ALL SELECT 'Cable Lateral Raise', 'side_delts', 'primary'
    UNION ALL SELECT 'Rear Delt Fly (Machine)', 'rear_delts', 'primary'
    UNION ALL SELECT 'Rear Delt Fly (Machine)', 'traps', 'secondary'
    UNION ALL SELECT 'Face Pull', 'rear_delts', 'primary'
    UNION ALL SELECT 'Face Pull', 'traps', 'secondary'
    UNION ALL SELECT 'Face Pull', 'side_delts', 'secondary'
    UNION ALL SELECT 'Dumbbell Arnold Press', 'front_delts', 'primary'
    UNION ALL SELECT 'Dumbbell Arnold Press', 'side_delts', 'primary'
    UNION ALL SELECT 'Dumbbell Arnold Press', 'triceps', 'secondary'
    UNION ALL SELECT 'Barbell Bicep Curl', 'biceps', 'primary'
    UNION ALL SELECT 'Incline Dumbbell Curl', 'biceps', 'primary'
    UNION ALL SELECT 'Hammer Curl', 'biceps', 'primary'
    UNION ALL SELECT 'Dumbbell Bicep Curl', 'biceps', 'primary'
    UNION ALL SELECT 'Preacher Curl', 'biceps', 'primary'
    UNION ALL SELECT 'Cable Curl', 'biceps', 'primary'
    UNION ALL SELECT 'Skull Crushers (EZ Bar)', 'triceps', 'primary'
    UNION ALL SELECT 'Triceps Rope Pushdown', 'triceps', 'primary'
    UNION ALL SELECT 'Overhead Cable Triceps Extension', 'triceps', 'primary'
    UNION ALL SELECT 'Close-Grip Bench Press', 'triceps', 'primary'
    UNION ALL SELECT 'Close-Grip Bench Press', 'chest', 'secondary'
    UNION ALL SELECT 'Close-Grip Bench Press', 'front_delts', 'secondary'
    UNION ALL SELECT 'Barbell Back Squat', 'quads', 'primary'
    UNION ALL SELECT 'Barbell Back Squat', 'glutes', 'primary'
    UNION ALL SELECT 'Barbell Back Squat', 'hamstrings', 'secondary'
    UNION ALL SELECT 'Barbell Back Squat', 'lower_back', 'secondary'
    UNION ALL SELECT 'Barbell Back Squat', 'abs', 'secondary'
    UNION ALL SELECT 'Leg Press', 'quads', 'primary'
    UNION ALL SELECT 'Leg Press', 'glutes', 'secondary'
    UNION ALL SELECT 'Leg Press', 'hamstrings', 'secondary'
    UNION ALL SELECT 'Hack Squat', 'quads', 'primary'
    UNION ALL SELECT 'Hack Squat', 'glutes', 'secondary'
    UNION ALL SELECT 'Leg Extension', 'quads', 'primary'
    UNION ALL SELECT 'Bulgarian Split Squat', 'quads', 'primary'
    UNION ALL SELECT 'Bulgarian Split Squat', 'glutes', 'primary'
    UNION ALL SELECT 'Bulgarian Split Squat', 'hamstrings', 'secondary'
    UNION ALL SELECT 'Romanian Deadlift', 'hamstrings', 'primary'
    UNION ALL SELECT 'Romanian Deadlift', 'glutes', 'primary'
    UNION ALL SELECT 'Romanian Deadlift', 'lower_back', 'secondary'
    UNION ALL SELECT 'Leg Curl (Seated/Lying)', 'hamstrings', 'primary'
    UNION ALL SELECT 'Leg Curl (Seated/Lying)', 'calves', 'secondary'
    UNION ALL SELECT 'Barbell Hip Thrust', 'glutes', 'primary'
    UNION ALL SELECT 'Barbell Hip Thrust', 'hamstrings', 'secondary'
    UNION ALL SELECT 'Cable Glute Kickback', 'glutes', 'primary'
    UNION ALL SELECT 'Cable Glute Kickback', 'hamstrings', 'secondary'
    UNION ALL SELECT 'Standing Calf Raise', 'calves', 'primary'
    UNION ALL SELECT 'Seated Calf Raise', 'calves', 'primary'
    UNION ALL SELECT 'Hanging Leg Raise', 'abs', 'primary'
    UNION ALL SELECT 'Hanging Leg Raise', 'obliques', 'secondary'
    UNION ALL SELECT 'Cable Crunch', 'abs', 'primary'
    UNION ALL SELECT 'Cable Crunch', 'obliques', 'secondary'
    UNION ALL SELECT 'Ab Wheel Rollout', 'abs', 'primary'
    UNION ALL SELECT 'Ab Wheel Rollout', 'obliques', 'secondary'
    UNION ALL SELECT 'Ab Wheel Rollout', 'lats', 'secondary'
) AS m ON m.name = e.name;

-- -----------------------------------------------------------------------------
-- Built-in Food Library (28 athletic staples across 7 categories)
-- -----------------------------------------------------------------------------
INSERT INTO foods (user_id, name, category, serving_label, serving_grams, calories, protein_g, carbs_g, fat_g) VALUES
-- Protein
(NULL, 'Chicken Breast (Grilled)',       'protein',      '150 g cooked',     150, 248, 46.5,  0.0,  5.4),
(NULL, 'Lean Ground Beef (93/7)',        'protein',      '150 g cooked',     150, 258, 39.0,  0.0, 10.5),
(NULL, 'Atlantic Salmon Fillet',         'protein',      '150 g cooked',     150, 312, 33.0,  0.0, 19.5),
(NULL, 'Canned Tuna in Water',           'protein',      '1 can (120 g)',    120, 132, 29.0,  0.0,  1.2),
(NULL, 'Paneer (Low-Fat Cottage Cheese)','protein',      '100 g',            100, 265, 18.3,  3.4, 20.8),
(NULL, 'Tofu (Extra Firm)',              'protein',      '150 g',            150, 180, 21.0,  3.0,  9.0),
-- Dairy & Eggs
(NULL, 'Whole Large Eggs (2 eggs)',      'dairy_eggs',   '2 large (100 g)',  100, 144, 12.6,  0.8,  9.6),
(NULL, 'Liquid Egg Whites',              'dairy_eggs',   '200 ml',           200, 104, 22.0,  1.4,  0.4),
(NULL, 'Greek Yogurt (0% Non-Fat)',      'dairy_eggs',   '1 cup (200 g)',    200, 118, 20.0,  7.8,  0.4),
(NULL, 'Skim Milk',                      'dairy_eggs',   '250 ml glass',     250,  86,  8.5, 12.5,  0.3),
-- Grains & Carbs
(NULL, 'Jasmine White Rice (Cooked)',    'grains_carbs', '1 cup (180 g)',    180, 234,  4.3, 50.4,  0.4),
(NULL, 'Rolled Oats (Dry)',              'grains_carbs', '80 g bowl',         80, 303, 10.5, 54.0,  5.2),
(NULL, 'Sweet Potato (Baked)',           'grains_carbs', '200 g medium',     200, 180,  4.0, 41.4,  0.3),
(NULL, 'Whole Wheat Bread',              'grains_carbs', '2 slices (70 g)',   70, 178,  8.4, 30.0,  2.4),
(NULL, 'Whole Wheat Roti / Chapati',     'grains_carbs', '2 rotis (80 g)',    80, 240,  7.8, 46.0,  2.6),
-- Fruits & Veg
(NULL, 'Banana (Medium)',                'fruits_veg',   '1 medium (120 g)', 120, 105,  1.3, 27.0,  0.4),
(NULL, 'Blueberries',                    'fruits_veg',   '1 cup (150 g)',    150,  85,  1.1, 21.6,  0.5),
(NULL, 'Steamed Broccoli & Greens',      'fruits_veg',   '150 g',            150,  52,  4.2, 10.0,  0.6),
(NULL, 'Avocado',                        'fruits_veg',   '1/2 medium (75 g)', 75, 120,  1.5,  6.4, 11.0),
-- Fats & Nuts
(NULL, 'Natural Peanut Butter',          'fats_nuts',    '2 tbsp (32 g)',     32, 190,  8.0,  6.0, 16.0),
(NULL, 'Raw Almonds',                    'fats_nuts',    '30 g handful',      30, 174,  6.3,  6.5, 15.0),
(NULL, 'Extra Virgin Olive Oil',         'fats_nuts',    '1 tbsp (14 g)',     14, 119,  0.0,  0.0, 13.5),
-- Drinks & Supplements
(NULL, 'Whey Protein Isolate',           'drinks_supps', '1 scoop (32 g)',    32, 120, 27.0,  1.5,  0.5),
(NULL, 'Mass Gainer Shake',              'drinks_supps', '1 serving (100 g)',100, 380, 25.0, 62.0,  3.5),
(NULL, 'Electrolyte Intra-Workout',      'drinks_supps', '500 ml bottle',    500,  45,  0.0, 11.0,  0.0),
-- Complete Meals
(NULL, 'Chicken & Rice Bowl',            'meals',        '1 bowl (400 g)',   400, 560, 48.0, 62.0, 11.5),
(NULL, 'Protein Oatmeal w/ Whey & Berries','meals',      '1 bowl (350 g)',   350, 495, 38.5, 68.0,  7.2),
(NULL, 'Steak, Sweet Potato & Broccoli', 'meals',        '1 plate (420 g)',  420, 620, 52.0, 48.0, 22.0);
