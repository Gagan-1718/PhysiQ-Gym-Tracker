# Query Performance & EXPLAIN Analysis Guide

This document demonstrates the execution plans, indexing strategies, and performance optimizations implemented in PhysiQ for the DBMS Level 3 Evaluation.

---

## 1. Index Strategy Justification

PhysiQ uses composite indexes tailored to its access patterns:

1. **`workout_sessions (user_id, session_date DESC)`**:
   - *Problem*: In a multi-tenant or multi-user database, querying user workout history filtered by date range causes a full table scan (`ALL`) without indexing.
   - *Solution*: A composite index on `(user_id, session_date)` allows MySQL's B-Tree to immediately jump to the user partition and scan only the relevant date range in reverse order (`type: range` / `ref`), achieving `O(log N)` complexity.

2. **`nutrition_logs (user_id, log_date DESC)`**:
   - *Problem*: Aggregating daily macronutrient totals requires joining and filtering by user and specific date.
   - *Solution*: Direct index seek on user and date.

3. **`sets (session_id, exercise_id)`**:
   - *Problem*: Retrieving sets per workout session or calculating volume.
   - *Solution*: Instant index seek on `session_id`.

---

## 2. EXPLAIN Comparison

### Scenario A: Workout History Retrieval
```sql
EXPLAIN SELECT * 
FROM workout_sessions 
WHERE user_id = 1 AND session_date BETWEEN '2026-09-01' AND '2026-10-01';
```

| Output Field | With Index (`idx_workout_sessions_user_date`) | Without Index (Full Table Scan) |
|---|---|---|
| `select_type` | `SIMPLE` | `SIMPLE` |
| `table` | `workout_sessions` | `workout_sessions` |
| `type` | `range` / `ref` | `ALL` |
| `possible_keys` | `idx_workout_sessions_user_date` | `NULL` |
| `key` | `idx_workout_sessions_user_date` | `NULL` |
| `rows` | **~5 (Only matching rows)** | **Full table row count** |
| `Extra` | `Using index condition` | `Using where` |

---

## 3. Advanced Query Demonstrations

All analytical queries are located in [`database/queries/demo_analytical_queries.sql`](file:///Users/thedemigod/Documents/PESU/dbms/PhysiQ/PhysiQ-Gym-Tracker/database/queries/demo_analytical_queries.sql):

- **Volume Progression Query**: Multi-table inner joins across 3 tables (`workout_sessions`, `sets`, `exercises`) with aggregate calculations (`SUM`, `AVG`).
- **Overdue Body Part Detection**: Dynamic case evaluation and date diffing against MySQL triggers.
- **Progression Correlated Subquery**: Compares 30-day top performance against historical exercise average using `HAVING` and subqueries.
