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
