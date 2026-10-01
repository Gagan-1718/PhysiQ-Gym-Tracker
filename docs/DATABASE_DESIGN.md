# Database Architecture & Design Document

## 1. Overview & Polyglot Persistence Justification

PhysiQ uses a hybrid (Polyglot) database architecture combining **MySQL** (Relational) and **MongoDB** (Document-oriented NoSQL).

| Database Paradigm | Engine | Target Data | Justification |
|---|---|---|---|
| **Relational (SQL)** | MySQL 8.0+ | Users, Splits, Workouts, Sets, Exercises, PRs, Diet Logs, Measurements | Structured, highly relational, strictly typed data requiring strong consistency, 3NF normalization, foreign key integrity, and ACID transactional guarantees. |
| **Document (NoSQL)** | MongoDB | Progress Photo Metadata | Unstructured/semi-structured metadata where attributes (angles, lighting notes, conditioning tags, weight snapshots) vary per upload without requiring sparse schema mutations. |

---

## 2. Normalization Analysis (3NF)

The relational schema is strictly normalized up to **Third Normal Form (3NF)**:

1. **First Normal Form (1NF)**:
   - All table attributes hold atomic (indivisible) values.
   - Repeating groups (such as sets within a workout) are separated into child tables (`sets`, `split_days`, `nutrition_logs`) with unique primary keys.

2. **Second Normal Form (2NF)**:
   - All non-key attributes are fully functionally dependent on the entire primary key. No partial key dependencies exist on composite keys.

3. **Third Normal Form (3NF)**:
   - Transitive dependencies are removed.
   - *Example*: In `nutrition_logs`, calories and macros are **not** duplicated from `foods`. Instead, `nutrition_logs` only stores `quantity` and a foreign key `food_id`. Totals are calculated dynamically via database views (`view_daily_macro_totals`), eliminating data redundancy and update anomalies.
   - *Example*: In `sets`, exercise metadata (muscle group, equipment) is referenced via `exercise_id` rather than duplicated in every set.

---

## 3. Entity-Relationship & Cardinalities

- **users (1) ── (N) splits**: A user can create multiple splits, with one marked active.
- **splits (1) ── (N) split_days**: A split consists of multiple ordered training days/body parts.
- **users (1) ── (N) workout_sessions**: A user logs multiple workout sessions over time.
- **workout_sessions (1) ── (N) sets**: A session contains multiple performed sets.
- **exercises (1) ── (N) sets**: An exercise is performed across multiple sets.
- **users (1) ── (N) personal_records**: A user tracks best performance per exercise.
- **exercises (1) ── (N) personal_records**: Each record links to an exercise in the master library.
- **users (1) ── (N) nutrition_logs**: A user logs multiple food items across days.
- **foods (1) ── (N) nutrition_logs**: Master food items are referenced in intake logs.
- **users (1) ── (N) body_measurements**: Time-series measurement records per user.
- **users (1) ── (N) photo_metadata (MongoDB)**: Progress photo documents per user.

---

## 4. Advanced DBMS Features Implemented

1. **ACID Transactions**: Atomic workout submission logic preventing orphan sets or inconsistent volume calculations.
2. **Database Triggers**:
   - `trg_after_workout_session_insert`: Auto-updates `split_days.last_trained_date`.
   - `trg_after_set_insert` / `trg_after_set_update` / `trg_after_set_delete`: Real-time computation of `workout_sessions.total_volume`.
3. **Stored Procedures & Functions**:
   - `sp_get_next_body_part`: Adaptive overdue body-part recommendation.
   - `sp_estimate_next_target`: Next load/reps target estimation for progressive overload.
   - `fn_calculate_1rm`: Epley formula 1-rep max calculator.
   - `sp_check_and_update_pr`: Automated PR tracking.
4. **Relational Views**:
   - `view_daily_macro_totals`: Dynamic aggregation of daily nutrition.
   - `view_personal_records_detailed`: PR summary joined with exercise metadata.
   - `view_weekly_summary`: Aggregated weekly training volume and adherence.
5. **Composite & Performance Indexes**:
   - `idx_workout_sessions_user_date (user_id, session_date)`
   - `idx_nutrition_logs_user_date (user_id, log_date)`
   - `idx_sets_session_exercise (session_id, exercise_id)`
