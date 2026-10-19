# PhysiQ Data Dictionary

> Generated from the live `information_schema` by `npm run docs:dictionary`. Do not edit by hand.

**MySQL:** 12 tables, 5 views, 9 procedures, 5 functions, 11 triggers.
**MongoDB:** `custom_routines`, `journey_stories` (validators in `database/mongodb/`).

## 1. `users`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | int | no |  | PRI | auto_increment |
| `name` | varchar(100) | no |  |  |  |
| `email` | varchar(150) | no |  | UNI |  |
| `password_hash` | varchar(255) | no |  |  | bcrypt hash (10 rounds), never plaintext |
| `role` | enum('member','admin') | no | member |  |  |
| `goal` | enum('hypertrophy','strength','fat_loss','maintenance') | no | hypertrophy |  |  |
| `height` | decimal(5,2) | yes |  |  | cm |
| `starting_weight` | decimal(5,2) | yes |  |  | kg, used until the first body measurement is logged |
| `created_at` | timestamp | no | CURRENT_TIMESTAMP |  |  |
| `updated_at` | timestamp | no | CURRENT_TIMESTAMP |  | on update CURRENT_TIMESTAMP |

**Checks:** `chk_users_email`: `` (`email` like _utf8mb4'%_@_%._%') `` · `chk_users_height`: `` ((`height` is null) or (`height` between 100 and 250)) `` · `chk_users_starting_weight`: `` ((`starting_weight` is null) or (`starting_weight` between 30 and 300)) ``

**Indexes:** `PRIMARY` (unique) (id) · `uq_users_email` (unique) (email)

## 2. `muscle_groups`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | int | no |  | PRI | auto_increment |
| `name` | varchar(30) | no |  | UNI |  |
| `region` | enum('upper','lower','core') | no |  |  |  |

**Indexes:** `PRIMARY` (unique) (id) · `uq_muscle_groups_name` (unique) (name)

## 3. `exercises`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | int | no |  | PRI | auto_increment |
| `name` | varchar(150) | no |  | UNI |  |
| `muscle_group_id` | int | no |  | MUL | FK → `muscle_groups.id` ON DELETE RESTRICT |
| `equipment_needed` | enum('Barbell','Dumbbell','Machine','Cable','Bodyweight','Kettlebell','Band','Other') | no | Bodyweight |  |  |
| `instructions` | text | yes |  |  |  |
| `created_at` | timestamp | no | CURRENT_TIMESTAMP |  |  |

**Indexes:** `PRIMARY` (unique) (id) · `idx_exercises_muscle_group_name` (muscle_group_id, name) · `uq_exercises_name` (unique) (name)

## 4. `splits`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | int | no |  | PRI | auto_increment |
| `user_id` | int | no |  | MUL | FK → `users.id` ON DELETE CASCADE |
| `split_name` | varchar(100) | no |  |  |  |
| `is_active` | tinyint(1) | no | 1 |  |  |
| `active_slot` | tinyint | yes |  |  | STORED GENERATED; = if(`is_active`,1,NULL) |
| `created_at` | timestamp | no | CURRENT_TIMESTAMP |  |  |

**Indexes:** `PRIMARY` (unique) (id) · `uq_splits_one_active_per_user` (unique) (user_id, active_slot)

## 5. `split_days`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | int | no |  | PRI | auto_increment |
| `split_id` | int | no |  | MUL | FK → `splits.id` ON DELETE CASCADE |
| `body_part` | varchar(50) | no |  |  | day label, e.g. Push, Pull, Legs, Upper |
| `day_order` | tinyint unsigned | no |  |  |  |
| `min_rest_days` | tinyint unsigned | no | 2 |  | recovery window before this day is ready again |
| `last_trained_date` | date | yes |  |  | trigger-maintained cache of MAX(workout_sessions.session_date) |

**Checks:** `chk_split_days_order`: `` (`day_order` between 1 and 14) `` · `chk_split_days_rest`: `` (`min_rest_days` between 0 and 7) ``

**Indexes:** `PRIMARY` (unique) (id) · `uq_split_days_label` (unique) (split_id, body_part) · `uq_split_days_order` (unique) (split_id, day_order)

## 6. `split_day_muscles`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `split_day_id` | int | no |  | PRI | FK → `split_days.id` ON DELETE CASCADE |
| `muscle_group_id` | int | no |  | PRI | FK → `muscle_groups.id` ON DELETE RESTRICT |

**Indexes:** `PRIMARY` (unique) (split_day_id, muscle_group_id) · `fk_sdm_muscle_group` (muscle_group_id)

## 7. `workout_sessions`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | int | no |  | PRI | auto_increment |
| `user_id` | int | no |  | MUL | FK → `users.id` ON DELETE CASCADE |
| `split_day_id` | int | yes |  | MUL | FK → `split_days.id` ON DELETE SET NULL; NULL for ad-hoc sessions or after the split is deleted |
| `session_date` | date | no |  |  |  |
| `body_part` | varchar(50) | no |  |  | label snapshot at training time, so history survives split edits |
| `started_at` | datetime | yes |  |  |  |
| `ended_at` | datetime | yes |  |  |  |
| `total_volume` | decimal(10,2) | no | 0.00 |  | trigger-maintained: SUM(weight*reps) of working sets |
| `notes` | varchar(500) | yes |  |  |  |
| `client_ref` | char(36) | yes |  |  | idempotency key from the device: a retried submit cannot create a duplicate session |
| `created_at` | timestamp | no | CURRENT_TIMESTAMP |  |  |

**Checks:** `chk_sessions_times`: `` ((`started_at` is null) or (`ended_at` is null) or (`ended_at` >= `started_at`)) `` · `chk_sessions_volume`: `` (`total_volume` >= 0) ``

**Indexes:** `PRIMARY` (unique) (id) · `idx_workout_sessions_split_day_date` (split_day_id, session_date) · `idx_workout_sessions_user_date` (user_id, session_date DESC) · `uq_sessions_client_ref` (unique) (user_id, client_ref)

## 8. `sets`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | int | no |  | PRI | auto_increment |
| `session_id` | int | no |  | MUL | FK → `workout_sessions.id` ON DELETE CASCADE |
| `exercise_id` | int | no |  | MUL | FK → `exercises.id` ON DELETE RESTRICT |
| `set_number` | tinyint unsigned | no |  |  | 1-based, per exercise within the session |
| `reps` | smallint unsigned | no |  |  |  |
| `weight` | decimal(6,2) | no | 0.00 |  | kg; 0 for bodyweight |
| `is_warmup` | tinyint(1) | no | 0 |  |  |
| `rpe` | decimal(3,1) | yes |  |  | Rate of Perceived Exertion 1-10 |
| `created_at` | timestamp | no | CURRENT_TIMESTAMP |  |  |

**Checks:** `chk_sets_number`: `` (`set_number` between 1 and 50) `` · `chk_sets_reps`: `` (`reps` between 1 and 100) `` · `chk_sets_rpe`: `` ((`rpe` is null) or (`rpe` between 1 and 10)) `` · `chk_sets_weight`: `` (`weight` between 0 and 999.99) ``

**Indexes:** `PRIMARY` (unique) (id) · `idx_sets_exercise_session` (exercise_id, session_id) · `uq_sets_session_exercise_number` (unique) (session_id, exercise_id, set_number)

## 9. `personal_records`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `user_id` | int | no |  | PRI | FK → `users.id` ON DELETE CASCADE |
| `exercise_id` | int | no |  | PRI | FK → `exercises.id` ON DELETE RESTRICT |
| `set_id` | int | no |  | UNI | FK → `sets.id` ON DELETE CASCADE |
| `updated_at` | timestamp | no | CURRENT_TIMESTAMP |  | on update CURRENT_TIMESTAMP |

**Indexes:** `PRIMARY` (unique) (user_id, exercise_id) · `fk_pr_exercise` (exercise_id) · `uq_personal_records_set` (unique) (set_id)

## 10. `body_measurements`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | int | no |  | PRI | auto_increment |
| `user_id` | int | no |  | MUL | FK → `users.id` ON DELETE CASCADE |
| `recorded_on` | date | no |  |  |  |
| `weight` | decimal(5,2) | yes |  |  | kg |
| `waist` | decimal(5,2) | yes |  |  | cm |
| `chest` | decimal(5,2) | yes |  |  | cm |
| `arms` | decimal(5,2) | yes |  |  | cm |
| `created_at` | timestamp | no | CURRENT_TIMESTAMP |  |  |

**Checks:** `chk_bm_any_value`: `` ((`weight` is not null) or (`waist` is not null) or (`chest` is not null) or (`arms` is not null)) `` · `chk_bm_arms`: `` ((`arms` is null) or (`arms` between 15 and 80)) `` · `chk_bm_chest`: `` ((`chest` is null) or (`chest` between 50 and 200)) `` · `chk_bm_waist`: `` ((`waist` is null) or (`waist` between 40 and 200)) `` · `chk_bm_weight`: `` ((`weight` is null) or (`weight` between 30 and 300)) ``

**Indexes:** `PRIMARY` (unique) (id) · `uq_body_measurements_user_day` (unique) (user_id, recorded_on)

## 11. `user_daily_fuel`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `user_id` | int | no |  | PRI | FK → `users.id` ON DELETE CASCADE |
| `fuel_date` | date | no |  | PRI |  |
| `protein_target_g` | smallint unsigned | no |  |  |  |
| `water_target_ml` | smallint unsigned | no |  |  |  |
| `calorie_target` | smallint unsigned | no |  |  |  |
| `protein_logged_g` | smallint unsigned | no | 0 |  |  |
| `water_logged_ml` | smallint unsigned | no | 0 |  |  |
| `updated_at` | timestamp | no | CURRENT_TIMESTAMP |  | on update CURRENT_TIMESTAMP |

**Checks:** `chk_fuel_protein`: `` (`protein_logged_g` <= 1000) `` · `chk_fuel_water`: `` (`water_logged_ml` <= 15000) ``

**Indexes:** `PRIMARY` (unique) (user_id, fuel_date)

## 12. `admin_audit_logs`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | bigint | no |  | PRI | auto_increment |
| `admin_id` | int | yes |  | MUL | FK → `users.id` ON DELETE SET NULL |
| `action` | enum('INSERT','UPDATE','DELETE') | no |  |  |  |
| `target_table` | varchar(64) | no |  |  |  |
| `target_id` | int | no |  |  |  |
| `details` | json | yes |  |  |  |
| `created_at` | timestamp | no | CURRENT_TIMESTAMP | MUL |  |

**Indexes:** `PRIMARY` (unique) (id) · `fk_audit_admin` (admin_id) · `idx_admin_audit_logs_created` (created_at DESC)

## Views

- `view_exercise_session_best`
- `view_personal_records_detailed`
- `view_split_day_status`
- `view_weekly_muscle_volume`
- `view_weekly_summary`

## Stored routines

- function `fn_calculate_1rm`
- function `fn_calorie_target`
- function `fn_current_weight`
- function `fn_protein_target_g`
- function `fn_water_target_ml`
- procedure `sp_assert_valid_session`
- procedure `sp_check_and_update_pr`
- procedure `sp_ensure_daily_fuel`
- procedure `sp_estimate_next_target`
- procedure `sp_get_daily_fuel`
- procedure `sp_get_next_body_part`
- procedure `sp_log_fuel`
- procedure `sp_rebuild_personal_records`
- procedure `sp_refresh_last_trained`

## Triggers

| Trigger | Timing | Event | Table |
|---|---|---|---|
| `trg_exercises_ad` | AFTER | DELETE | `exercises` |
| `trg_exercises_ai` | AFTER | INSERT | `exercises` |
| `trg_exercises_au` | AFTER | UPDATE | `exercises` |
| `trg_sets_ad` | AFTER | DELETE | `sets` |
| `trg_sets_ai` | AFTER | INSERT | `sets` |
| `trg_sets_au` | AFTER | UPDATE | `sets` |
| `trg_workout_sessions_ad` | AFTER | DELETE | `workout_sessions` |
| `trg_workout_sessions_ai` | AFTER | INSERT | `workout_sessions` |
| `trg_workout_sessions_au` | AFTER | UPDATE | `workout_sessions` |
| `trg_workout_sessions_bi` | BEFORE | INSERT | `workout_sessions` |
| `trg_workout_sessions_bu` | BEFORE | UPDATE | `workout_sessions` |
