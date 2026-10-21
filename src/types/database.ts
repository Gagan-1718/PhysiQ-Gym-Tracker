// Row and DTO types for the PhysiQ schema (MySQL + MongoDB).
// Dates are 'YYYY-MM-DD' strings and DATETIMEs 'YYYY-MM-DD HH:MM:SS' (pool uses dateStrings).

export type UserRole = 'member' | 'admin';
export type Goal = 'hypertrophy' | 'strength' | 'fat_loss' | 'maintenance';
export type Equipment = 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' | 'Kettlebell' | 'Band' | 'Other';
export type DayStatus = 'new' | 'recovering' | 'ready' | 'overdue';

export const GOALS: { value: Goal; label: string; blurb: string }[] = [
  { value: 'hypertrophy', label: 'Build muscle', blurb: '+300 kcal surplus' },
  { value: 'strength', label: 'Get stronger', blurb: '+200 kcal surplus' },
  { value: 'fat_loss', label: 'Lose fat', blurb: '-400 kcal deficit' },
  { value: 'maintenance', label: 'Maintain', blurb: 'Eat at maintenance' },
];

export const EQUIPMENT: Equipment[] = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band', 'Other'];

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  goal: Goal;
  height: number | null;
  starting_weight: number | null;
  weekly_goal: number;
  created_at: string;
}

export interface MuscleGroup {
  id: number;
  name: string;
  region: 'upper' | 'lower' | 'core';
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group_id: number;
  muscle_group: string;
  equipment_needed: Equipment;
  instructions: string | null;
}

/** Row of view_split_day_status */
export interface SplitDayStatus {
  split_id: number;
  split_name: string;
  split_day_id: number;
  body_part: string;
  day_order: number;
  min_rest_days: number;
  last_trained_date: string | null;
  days_since: number | null;
  status: DayStatus;
  days_until_ready: number;
  priority_rank: number;
  muscles: string[];
}

/** Row of view_split_day_status where status = overdue (GET /api/alerts) */
export interface OverdueAlert {
  split_day_id: number;
  body_part: string;
  days_since: number;
  last_trained_date: string;
  min_rest_days: number;
}

export interface Recommendation {
  split_day_id: number | null;
  body_part: string;
  days_since: number | null;
  status: DayStatus;
}

export interface OverloadTarget {
  suggested_weight: number | null;
  suggested_reps: number;
  last_weight: number | null;
  last_reps: number | null;
  last_date: string | null;
  rationale: string;
}

/** Per-exercise data the logger loads when an exercise is added (GET /api/train/context) */
export interface ExerciseContext {
  target: OverloadTarget;
  last: LastPerformanceSet[];
  pr: { weight: number; reps: number; estimated_1rm: number } | null;
}

export interface LastPerformanceSet {
  set_number: number;
  weight: number;
  reps: number;
  is_warmup: boolean;
}

export interface SessionSummary {
  id: number;
  session_date: string;
  body_part: string;
  split_day_id: number | null;
  started_at: string | null;
  ended_at: string | null;
  total_volume: number;
  notes: string | null;
  exercise_count: number;
  working_sets: number;
  pr_count: number;
}

export interface SessionSet {
  id: number;
  exercise_id: number;
  exercise_name: string;
  muscle_group: string;
  set_number: number;
  reps: number;
  weight: number;
  is_warmup: boolean;
  rpe: number | null;
  is_pr: boolean;
}

export interface PersonalRecord {
  exercise_id: number;
  exercise_name: string;
  muscle_group: string;
  weight: number;
  reps: number;
  estimated_1rm: number;
  achieved_on: string;
  session_id: number;
}

export interface DailyFuel {
  fuel_date: string;
  protein_target_g: number;
  protein_logged_g: number;
  water_target_ml: number;
  water_logged_ml: number;
  calorie_target: number;
  body_weight_kg: number | null;
}

export interface WeeklySummary {
  week_start: string;
  sessions_completed: number;
  total_volume: number;
  working_sets: number;
  minutes_trained: number;
  body_parts_trained: string;
}

export interface BodyMeasurement {
  id: number;
  recorded_on: string;
  weight: number | null;
  waist: number | null;
  chest: number | null;
  arms: number | null;
}

// ---- MongoDB documents (serialised for the client) ----

export interface RoutineExercise {
  exercise_id: number;
  name: string;
  target_sets: number;
  rep_min?: number;
  rep_max?: number;
  rest_seconds?: number;
  superset?: string | null;
  notes?: string | null;
}

export interface Routine {
  id: string;
  name: string;
  focus: string | null;
  notes: string | null;
  exercises: RoutineExercise[];
  times_used: number;
  last_used_at: string | null;
  updated_at: string;
}

export interface JourneyStory {
  id: string;
  date: string;
  kind: 'workout_journal' | 'progress_photo' | 'milestone' | 'note';
  session_id: number | null;
  caption: string | null;
  mood: number | null;
  energy: number | null;
  tags: string[];
  weight_snapshot: number | null;
  created_at: string;
}
