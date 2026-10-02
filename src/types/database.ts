// TypeScript Definitions for PhysiQ Database Schema (MySQL)

export type UserRole = 'member' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  goal?: string;
  height?: number;
  starting_weight?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Split {
  id: number;
  user_id: number;
  split_name: string;
  is_active: boolean;
  created_at: Date;
}

export interface SplitDay {
  id: number;
  split_id: number;
  body_part: string;
  day_order: number;
  last_trained_date?: string | null;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string;
  equipment_needed: string;
  instructions?: string | null;
  created_at: Date;
}

export interface WorkoutSession {
  id: number;
  user_id: number;
  session_date: string;
  body_part: string;
  total_volume: number;
  notes?: string | null;
  created_at: Date;
}

export interface SetEntry {
  id: number;
  session_id: number;
  exercise_id: number;
  set_number: number;
  reps: number;
  weight: number;
  is_warmup: boolean;
  rpe?: number | null;
  created_at: Date;
}

export interface PersonalRecord {
  id: number;
  user_id: number;
  exercise_id: number;
  weight: number;
  reps: number;
  achieved_on: string;
  created_at: Date;
}

export interface Food {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_unit: string;
  created_at: Date;
}

export interface NutritionLog {
  id: number;
  user_id: number;
  food_id: number;
  quantity: number;
  meal_type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  log_date: string;
  created_at: Date;
}

export interface BodyMeasurement {
  id: number;
  user_id: number;
  weight?: number | null;
  waist?: number | null;
  chest?: number | null;
  arms?: number | null;
  recorded_on: string;
  created_at: Date;
}

export interface ProgressPhoto {
  id: number;
  user_id: number;
  photo_url: string;
  date_taken: string;
  angle: 'front' | 'side' | 'back' | 'other';
  weight_at_time?: number | null;
  notes?: string | null;
  tags?: string[] | null; // Stored as JSON in MySQL
  created_at: Date;
}

// Stored Procedure Output Types
export interface NextBodyPartRecommendation {
  body_part: string;
  days_since_last_trained: number;
}

export interface NextTargetEstimate {
  suggested_weight: number;
  suggested_reps: number;
}
