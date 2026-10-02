# PhysiQ Data Dictionary (MySQL)

## Table 1: `users`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique user identifier |
| `name` | VARCHAR(100) | NO | | | User full name |
| `email` | VARCHAR(150) | NO | UNI | | User email for authentication |
| `password_hash` | VARCHAR(255) | NO | | | Bcrypt password hash |
| `role` | ENUM('member', 'admin') | NO | | 'member' | User role for RBAC |
| `goal` | VARCHAR(50) | YES | | 'hypertrophy' | Fitness goal (e.g. hypertrophy, fat loss) |
| `height` | DECIMAL(5,2) | YES | | NULL | Height in centimeters |
| `starting_weight` | DECIMAL(5,2) | YES | | NULL | Starting body weight in kg |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Registration timestamp |
| `updated_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Last profile update timestamp |

## Table 2: `splits`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique split identifier |
| `user_id` | INT | NO | FK | | References `users(id)` ON DELETE CASCADE |
| `split_name` | VARCHAR(100) | NO | | | Split title (e.g. PPL, Bro Split) |
| `is_active` | BOOLEAN | NO | | TRUE | Active status of split |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Creation timestamp |

## Table 3: `split_days`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique split day identifier |
| `split_id` | INT | NO | FK | | References `splits(id)` ON DELETE CASCADE |
| `body_part` | VARCHAR(50) | NO | | | Body part/category (e.g. Push, Pull) |
| `day_order` | INT | YES | | 1 | Sequence within split |
| `last_trained_date` | DATE | YES | | NULL | Date this body part was last trained |

## Table 4: `exercises`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique exercise identifier |
| `name` | VARCHAR(150) | NO | UNI | | Exercise name |
| `muscle_group` | VARCHAR(50) | NO | | | Target muscle group |
| `equipment_needed` | VARCHAR(100) | YES | | 'Bodyweight' | Required equipment |
| `instructions` | TEXT | YES | | NULL | Technique instructions |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Added timestamp |

## Table 5: `workout_sessions`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique session identifier |
| `user_id` | INT | NO | FK | | References `users(id)` ON DELETE CASCADE |
| `session_date` | DATE | NO | | | Date workout took place |
| `body_part` | VARCHAR(50) | NO | | | Target body part trained |
| `total_volume` | DECIMAL(10,2) | NO | | 0.00 | Total workload (sum of weight * reps) |
| `notes` | TEXT | YES | | NULL | Workout comments |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Session log timestamp |

## Table 6: `sets`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique set identifier |
| `session_id` | INT | NO | FK | | References `workout_sessions(id)` |
| `exercise_id` | INT | NO | FK | | References `exercises(id)` |
| `set_number` | INT | YES | | 1 | Set number in exercise |
| `reps` | INT | NO | | | Number of repetitions completed |
| `weight` | DECIMAL(6,2) | NO | | | Weight used in kg |
| `is_warmup` | BOOLEAN | NO | | FALSE | Flag to exclude from volume/PR logic |
| `rpe` | DECIMAL(3,1) | YES | | NULL | Rate of perceived exertion |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Log timestamp |

## Table 7: `personal_records`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique PR identifier |
| `user_id` | INT | NO | FK | | References `users(id)` |
| `exercise_id` | INT | NO | FK | | References `exercises(id)` |
| `weight` | DECIMAL(6,2) | NO | | | Max weight achieved |
| `reps` | INT | NO | | | Reps at max weight |
| `achieved_on` | DATE | NO | | | Date of PR |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | PR recorded timestamp |

## Table 8: `foods`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique food identifier |
| `name` | VARCHAR(150) | NO | UNI | | Food title |
| `calories` | DECIMAL(6,2) | NO | | | Calories per 100g (kcal) |
| `protein` | DECIMAL(6,2) | NO | | | Protein per 100g (g) |
| `carbs` | DECIMAL(6,2) | NO | | | Carbohydrates per 100g (g) |
| `fat` | DECIMAL(6,2) | NO | | | Fat per 100g (g) |
| `serving_unit` | VARCHAR(50) | YES | | '100g' | Base serving measurement |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Added timestamp |

## Table 9: `nutrition_logs`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique log entry identifier |
| `user_id` | INT | NO | FK | | References `users(id)` |
| `food_id` | INT | NO | FK | | References `foods(id)` |
| `quantity` | DECIMAL(6,2) | NO | | | Quantity consumed (g) |
| `meal_type` | ENUM(...) | NO | | 'Snack' | Breakfast, Lunch, Dinner, Snack |
| `log_date` | DATE | NO | | | Date of meal |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Log timestamp |

## Table 10: `body_measurements`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique entry identifier |
| `user_id` | INT | NO | FK | | References `users(id)` |
| `weight` | DECIMAL(5,2) | YES | | NULL | Body weight in kg |
| `waist` | DECIMAL(5,2) | YES | | NULL | Waist circumference in cm |
| `chest` | DECIMAL(5,2) | YES | | NULL | Chest circumference in cm |
| `arms` | DECIMAL(5,2) | YES | | NULL | Arm circumference in cm |
| `recorded_on` | DATE | NO | | | Measurement date |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Record timestamp |

## Table 11: `progress_photos`
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | INT | NO | PK | AUTO_INCREMENT | Unique photo record identifier |
| `user_id` | INT | NO | FK | | References `users(id)` ON DELETE CASCADE |
| `photo_url` | VARCHAR(500) | NO | | | Image URI / file path |
| `date_taken` | DATE | NO | | | Date photo was taken |
| `angle` | ENUM(...) | NO | | 'front' | Pose angle: front, side, back, other |
| `weight_at_time` | DECIMAL(5,2) | YES | | NULL | Body weight snapshot at photo time |
| `notes` | TEXT | YES | | NULL | Notes / comments |
| `tags` | JSON | YES | | NULL | JSON array of tags (e.g. `["morning", "fasted"]`) |
| `created_at` | TIMESTAMP | NO | | CURRENT_TIMESTAMP | Upload timestamp |
