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
