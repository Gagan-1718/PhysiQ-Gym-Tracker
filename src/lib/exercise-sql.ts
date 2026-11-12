/**
 * Columns every exercise row sent to the app carries (alias e = exercises,
 * mg = muscle_groups): the library data, the guided-workout weight step, and the
 * muscles it works from the exercise_muscles junction table (migration 003),
 * aggregated into one JSON array per exercise.
 */
export const EXERCISE_COLUMNS = `e.id, e.name, e.muscle_group_id, mg.name AS muscle_group, e.equipment_needed, e.instructions, e.media_key,
  e.weight_step_kg,
  (SELECT JSON_ARRAYAGG(JSON_OBJECT('code', em.region_code, 'label', mr.label, 'role', em.role))
     FROM exercise_muscles em JOIN muscle_regions mr ON mr.code = em.region_code
    WHERE em.exercise_id = e.id) AS muscles`;
