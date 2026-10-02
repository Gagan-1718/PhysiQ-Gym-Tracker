# PhysiQ — Database-Driven Gym Management & Adaptive Tracker

PhysiQ is a pure MySQL database-centric personal fitness tracking system designed to replace fragmented fitness logging with a single, intelligent feedback loop. Instead of rigidly following a static calendar (e.g., Monday = Push), PhysiQ uses relational workout history in MySQL to dynamically recommend the most overdue body part and calculate progressive overload targets.

---

## 🚀 Core Philosophy

> **PLAN → TRAIN → RECORD → ANALYZE → ADAPT → TRAIN AGAIN**

### Differentiator: Adaptive Training vs. Static Calendars
- **Standard Trackers**: Break down when workouts are missed because they depend on static calendar days.
- **PhysiQ**: Queries historical relational data in MySQL (`split_days`, `workout_sessions`) to compute what muscle groups are overdue, taking recovery intervals into account.

---

## 🛠️ Tech Stack & Architecture

- **Frontend & Full-Stack**: Next.js 14+ (App Router, Server Actions / Route Handlers)
- **Database (100% SQL)**: MySQL 8.0+ (3NF Normalized, 11 Tables)
- **Authentication**: NextAuth.js / Auth.js (Bcrypt password hashing)
- **Styling**: Tailwind CSS & Lucide Icons

---

## 🗄️ Database Architecture & Advanced MySQL Features

### 1. Relational Schema (MySQL — 11 Tables in 3NF)
- `users`: User profiles, goals, metrics, and role-based access (`member`, `admin`).
- `splits`: Named workout splits (e.g., PPL, Upper/Lower, Bro Split).
- `split_days`: Scheduled workout days linked with `last_trained_date`.
- `exercises`: Master exercise directory categorised by muscle group and equipment.
- `workout_sessions`: Workout header storing date, targeted body part, and calculated volume.
- `sets`: Individual set entries (weight, reps, warm-up status, RPE).
- `personal_records`: Best performance per exercise with automatic detection.
- `foods`: Master nutrition database (calories and macros per 100g).
- `nutrition_logs`: Daily food consumption entries.
- `body_measurements`: Time-series body metric logs (weight, waist, chest, arms).
- `progress_photos`: Visual progress tracking with camera angles and JSON tags.

### 2. Advanced MySQL Features Implemented
- **Triggers**:
  - `trg_after_workout_session_insert`: Auto-updates `split_days.last_trained_date`.
  - `trg_after_set_insert` / `trg_after_set_update` / `trg_after_set_delete`: Live session volume recalculation.
- **Stored Procedures & Functions**:
  - `sp_get_next_body_part`: Adaptive scheduling logic to find the most overdue muscle group.
  - `sp_estimate_next_target`: Progressive overload estimation based on recent performance.
  - `fn_calculate_1rm`: Epley 1-Rep Max formula function.
  - `sp_check_and_update_pr`: Automated PR tracking on set submission.
- **Views**:
  - `view_daily_macro_totals`: Real-time daily calorie and macronutrient computation.
  - `view_personal_records_detailed`: PR breakdown joined with exercise details.
  - `view_weekly_summary`: Weekly training volume, session counts, and consistency analysis.
- **Composite Indexes**:
  - `idx_workout_sessions_user_date (user_id, session_date DESC)`
  - `idx_nutrition_logs_user_date (user_id, log_date DESC)`
  - `idx_sets_session_exercise (session_id, exercise_id)`
  - `idx_progress_photos_user_date (user_id, date_taken DESC)`

---

## 📁 Repository Structure

```text
PhysiQ-Gym-Tracker/
├── database/
│   ├── schema.sql                 # Complete MySQL 3NF schema DDL (11 tables)
│   ├── triggers.sql               # Automated triggers for dates and volume
│   ├── procedures.sql             # Stored procedures & functions
│   ├── views.sql                  # Analytical and dashboard views
│   ├── indexes.sql                # Query performance composite indexes
│   └── seeds/
│       ├── exercises.sql          # Seed data for master exercise library
│       └── foods.sql              # Seed data for nutritional items
├── docs/
│   ├── DATABASE_DESIGN.md         # Comprehensive design & 3NF justification
│   └── DATA_DICTIONARY.md         # Full table-by-table attribute dictionary
├── src/
│   ├── app/                       # Next.js App Router (pages & API routes)
│   ├── lib/                       # MySQL connection pool & helpers
│   └── types/                     # TypeScript database types
├── .env.example                   # Environment configuration template
└── README.md
```

---

## ⚡ Quick Start & Database Setup

### 1. Initialize the MySQL Database
```bash
# Log in to MySQL and run scripts in order
mysql -u root -p < database/schema.sql
mysql -u root -p < database/triggers.sql
mysql -u root -p < database/procedures.sql
mysql -u root -p < database/views.sql
mysql -u root -p < database/indexes.sql
mysql -u root -p < database/seeds/exercises.sql
mysql -u root -p < database/seeds/foods.sql
```

### 2. Configure Environment
```bash
cp .env.example .env
# Update MySQL credentials in .env
```
