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

INSERT INTO exercises (name, muscle_group_id, equipment_needed, instructions) VALUES
-- Chest
('Barbell Bench Press',            @chest, 'Barbell',    'Lie on a flat bench, grip slightly wider than shoulders, lower to mid-chest, press up.'),
('Incline Barbell Bench Press',    @chest, 'Barbell',    'Bench at 30 degrees, lower the bar to the upper chest, press up and slightly back.'),
('Incline Dumbbell Press',         @chest, 'Dumbbell',   'Bench at 30-45 degrees, press the dumbbells up over the upper chest.'),
('Machine Chest Press',            @chest, 'Machine',    'Set the handles at mid-chest height, press forward without locking the elbows hard.'),
('Cable Chest Fly',                @chest, 'Cable',      'Stand between the stacks and bring the handles together in a wide hugging arc.'),
('Dips (Chest Focus)',             @chest, 'Bodyweight', 'Lean the torso forward and lower until the upper arms are parallel to the floor.'),
('Push-Up',                        @chest, 'Bodyweight', 'Brace the core, elbows at about 45 degrees, chest to just above the floor.'),
-- Back
('Barbell Deadlift',               @back, 'Barbell',    'Hip-width stance, grip outside the knees, push the floor away with a neutral spine.'),
('Lat Pulldown',                   @back, 'Cable',      'Wide grip, pull the bar to the upper chest while driving the elbows down.'),
('Barbell Bent-Over Row',          @back, 'Barbell',    'Hinge to about 45 degrees and row the bar to the belly button.'),
('Seated Cable Row',               @back, 'Cable',      'Sit tall with a neutral spine and pull the handle to the lower abdomen.'),
('Pull-Up',                        @back, 'Bodyweight', 'Overhand grip, pull the chest towards the bar with no kipping.'),
('One-Arm Dumbbell Row',           @back, 'Dumbbell',   'Knee and hand on the bench, row the dumbbell to the hip.'),
('Chest-Supported T-Bar Row',      @back, 'Machine',    'Chest on the pad, row the handles while squeezing the shoulder blades.'),
-- Shoulders
('Overhead Barbell Press',         @shoulders, 'Barbell',  'Standing, press the bar from the collarbone to straight overhead.'),
('Seated Dumbbell Shoulder Press', @shoulders, 'Dumbbell', 'Back supported, press the dumbbells from ear height to overhead.'),
('Dumbbell Lateral Raise',         @shoulders, 'Dumbbell', 'Raise the dumbbells out to the sides up to shoulder height, slight elbow bend.'),
('Cable Lateral Raise',            @shoulders, 'Cable',    'Cable at hip height, raise the arm out to the side across the body.'),
('Rear Delt Fly (Machine)',        @shoulders, 'Machine',  'Face the pad and sweep the handles back with straight arms.'),
('Face Pull',                      @shoulders, 'Cable',    'Rope at face height, pull towards the forehead with elbows high.'),
('Dumbbell Arnold Press',          @shoulders, 'Dumbbell', 'Rotate the wrists from palms-in to palms-out while pressing up.'),
-- Biceps
('Barbell Bicep Curl',             @biceps, 'Barbell',  'Stand tall, elbows pinned to the sides, curl the bar to the shoulders.'),
('Incline Dumbbell Curl',          @biceps, 'Dumbbell', 'Lie back on an incline bench, arms hanging, curl without moving the elbows.'),
('Hammer Curl',                    @biceps, 'Dumbbell', 'Neutral grip, curl the dumbbells while keeping the wrists straight.'),
('Preacher Curl',                  @biceps, 'Machine',  'Upper arms on the pad, curl up and lower under control.'),
('Cable Curl',                     @biceps, 'Cable',    'Straight bar on a low pulley, curl with elbows fixed at the sides.'),
-- Triceps
('Skull Crushers (EZ Bar)',        @triceps, 'Barbell', 'Lie on a bench and lower the EZ bar towards the forehead by bending the elbows.'),
('Triceps Rope Pushdown',          @triceps, 'Cable',   'Push the rope down and split the ends apart at the bottom.'),
('Overhead Cable Triceps Extension', @triceps, 'Cable', 'Facing away from the stack, extend the rope overhead from behind the head.'),
('Close-Grip Bench Press',         @triceps, 'Barbell', 'Shoulder-width grip, elbows tucked, lower to the lower chest and press.'),
-- Quads
('Barbell Back Squat',             @quads, 'Barbell',  'Bar on the upper back, sit down between the hips to at least parallel.'),
('Leg Press',                      @quads, 'Machine',  'Feet shoulder-width on the platform, lower until the knees reach about 90 degrees.'),
('Hack Squat',                     @quads, 'Machine',  'Shoulders under the pads, squat deep while keeping the back on the pad.'),
('Leg Extension',                  @quads, 'Machine',  'Extend the knees fully and squeeze the quads at the top.'),
('Bulgarian Split Squat',          @quads, 'Dumbbell', 'Rear foot on a bench, lower straight down on the front leg.'),
-- Hamstrings
('Romanian Deadlift',              @hamstrings, 'Barbell', 'Soft knees, hinge at the hips sliding the bar down the thighs to a deep stretch.'),
('Leg Curl (Seated/Lying)',        @hamstrings, 'Machine', 'Curl the pad towards the glutes and control the way back.'),
-- Glutes
('Barbell Hip Thrust',             @glutes, 'Barbell', 'Upper back on a bench, drive the hips up until the torso is level.'),
('Cable Glute Kickback',           @glutes, 'Cable',   'Ankle strap on, kick the leg back while keeping the hips square.'),
-- Calves
('Standing Calf Raise',            @calves, 'Machine', 'Rise onto the toes as high as possible, pause, lower to a full stretch.'),
('Seated Calf Raise',              @calves, 'Machine', 'Knees under the pad, raise the heels and pause at the top.'),
-- Core
('Hanging Leg Raise',              @core, 'Bodyweight', 'Hang from a bar and raise the legs to hip height without swinging.'),
('Cable Crunch',                   @core, 'Cable',      'Kneel with the rope at the head, crunch the ribs towards the hips.'),
('Ab Wheel Rollout',               @core, 'Other',      'From the knees, roll out as far as you can while keeping the lower back flat.');

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
