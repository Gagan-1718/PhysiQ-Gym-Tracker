# PhysiQ Database Architecture & Design Document

## 1. Overview

PhysiQ uses a **100% MySQL** relational database architecture designed for data integrity, 3NF normalization, transactional consistency, and advanced database-side intelligence.

---

## 2. Normalization Analysis (3NF)

The relational schema is strictly normalized up to **Third Normal Form (3NF)**:

1. **First Normal Form (1NF)**:
   - All table attributes hold atomic (indivisible) values.
   - Repeating groups (sets, split days, food logs) are separated into individual tables with unique primary keys.

2. **Second Normal Form (2NF)**:
   - All non-key attributes are fully functionally dependent on the entire primary key. No partial key dependencies exist.

3. **Third Normal Form (3NF)**:
   - Transitive dependencies are eliminated.
   - In `nutrition_logs`, calories and macros are referenced via `food_id` rather than duplicated per log entry. Totals are derived dynamically via views (`view_daily_macro_totals`).
   - In `sets`, exercise metadata (muscle group, equipment) is referenced via `exercise_id` rather than duplicated per set.

---

## 3. Entity-Relationship & Cardinalities

- **users (1) ── (N) splits**: A user can create multiple training splits.
- **splits (1) ── (N) split_days**: A split consists of multiple ordered workout days/body parts.
- **users (1) ── (N) workout_sessions**: A user logs multiple workout sessions over time.
- **workout_sessions (1) ── (N) sets**: A session contains multiple performed sets.
- **exercises (1) ── (N) sets**: An exercise is performed across multiple sets.
- **users (1) ── (N) personal_records**: A user tracks best performance per exercise.
- **exercises (1) ── (N) personal_records**: Each PR links to an exercise in the master library.
- **users (1) ── (N) nutrition_logs**: A user logs food consumption entries.
- **foods (1) ── (N) nutrition_logs**: Master food items are referenced in intake logs.
- **users (1) ── (N) body_measurements**: Time-series measurement records per user.
- **users (1) ── (N) progress_photos**: Progress photo records with metadata and JSON tags per user.

---

## 4. Advanced MySQL DBMS Features Implemented

1. **ACID Transactions**: Atomic workout submission logic ensuring session, sets, volume, and PRs succeed or rollback together.
2. **Database Triggers**:
   - `trg_after_workout_session_insert`: Auto-updates `split_days.last_trained_date`.
   - `trg_after_set_insert` / `trg_after_set_update` / `trg_after_set_delete`: Live session volume calculation.
3. **Stored Procedures & Functions**:
   - `sp_get_next_body_part`: Adaptive scheduling logic to find the most overdue muscle group.
   - `sp_estimate_next_target`: Progressive overload estimation based on recent performance.
   - `fn_calculate_1rm`: Epley 1-Rep Max formula function.
   - `sp_check_and_update_pr`: Automated PR tracking.
4. **Relational Views**:
   - `view_daily_macro_totals`: Dynamic aggregation of daily nutrition.
   - `view_personal_records_detailed`: PR summary joined with exercise metadata.
   - `view_weekly_summary`: Aggregated weekly training volume and adherence.
5. **Composite & Performance Indexes**:
   - `idx_workout_sessions_user_date (user_id, session_date)`
   - `idx_nutrition_logs_user_date (user_id, log_date)`
   - `idx_sets_session_exercise (session_id, exercise_id)`
   - `idx_personal_records_user_exercise (user_id, exercise_id)`
   - `idx_body_measurements_user_date (user_id, recorded_on)`
