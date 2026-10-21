# Query Performance & EXPLAIN Analysis

All numbers below are real output from MySQL 8.0.46, produced by
[`database/queries/explain_benchmark.sql`](../database/queries/explain_benchmark.sql).
The script loads 600 synthetic users × 100 sessions (60,019 rows including the
demo data), runs each query with and without the index, then deletes everything
it created. Re-run it any time:

```bash
mysql -u root -p -t < database/queries/explain_benchmark.sql
```

---

## 1. The query

The dashboard and history screens repeatedly ask: *"this user's sessions in a
date range, newest first"*.

```sql
SELECT id, session_date, body_part
FROM workout_sessions
WHERE user_id = @u AND session_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
ORDER BY session_date DESC;
```

## 2. With `idx_workout_sessions_user_date (user_id, session_date DESC)`

| id | select_type | table | type | possible_keys | key | key_len | rows | filtered | Extra |
|---|---|---|---|---|---|---|---|---|---|
| 1 | SIMPLE | workout_sessions | **range** | idx_workout_sessions_user_date | **idx_workout_sessions_user_date** | 7 | **7** | 100.00 | Using index condition |

```
-> Index range scan on workout_sessions using idx_workout_sessions_user_date
   over (user_id = 370 AND session_date <= '2026-09-19')
   (cost=3.41 rows=7) (actual time=0.0688..0.0735 rows=7 loops=1)
```

## 3. Same query, index ignored (`IGNORE INDEX`)

| id | select_type | table | type | possible_keys | key | rows | filtered | Extra |
|---|---|---|---|---|---|---|---|---|
| 1 | SIMPLE | workout_sessions | **ALL** | NULL | NULL | **60357** | 0.05 | Using where; **Using filesort** |

```
-> Sort: workout_sessions.session_date DESC  (cost=6085 rows=60357) (actual time=27.5..27.5 rows=7 loops=1)
    -> Filter: (user_id = @u and session_date >= curdate() - interval 30 day)
        -> Table scan on workout_sessions  (cost=6085 rows=60357) (actual time=0.345..22.9 rows=60019 loops=1)
```

## 4. Comparison

| | With index | Without index |
|---|---|---|
| Access type | `range` (B-Tree seek) | `ALL` (full table scan) |
| Rows examined | **7** | **60,019** |
| Sort | none: the index is already ordered `session_date DESC` | `filesort` |
| Optimiser cost | 3.41 | 6,085 |
| Actual time | **0.07 ms** | **27.5 ms** (~375× slower) |

**Why it works.** In a B-Tree on `(user_id, session_date DESC)`, all rows of one
user sit next to each other, already sorted newest-first. MySQL seeks straight
to `(user_id = 370, today - 30 days)`, reads 7 entries and stops. There is no
scan and no sort. Without the index it must read every row of every user,
filter them, then sort.

**Column order matters.** `user_id` goes first because it is an equality
predicate, and `session_date` second because it is the range and the sort key.
The reverse order `(session_date, user_id)` could not seek on the user.

---

## 5. Index strategy

| Index | Columns | Serves |
|---|---|---|
| `idx_workout_sessions_user_date` | `(user_id, session_date DESC)` | history, dashboard, weekly views; also enforces the `user_id` FK |
| `idx_workout_sessions_split_day_date` | `(split_day_id, session_date)` | `MAX(session_date)` in `sp_refresh_last_trained` (index-only) |
| `idx_sets_exercise_session` | `(exercise_id, session_id)` | exercise history, overload targets, PR detection |
| `idx_exercises_muscle_group_name` | `(muscle_group_id, name)` | library browsing by muscle, already sorted by name |
| `idx_admin_audit_logs_created` | `(created_at DESC)` | latest audit entries |
| `uq_sets_session_exercise_number` | `(session_id, exercise_id, set_number)` | unique constraint; also "all sets of a session" |
| `uq_body_measurements_user_day` | `(user_id, recorded_on)` | unique constraint; also body-weight history |
| `personal_records` PK | `(user_id, exercise_id)` | PR lookup per user |

Each composite index is left-prefixed by a foreign-key column, so MySQL uses it
to enforce that FK and drops the redundant single-column index it would
otherwise create. We get no duplicate indexes and no extra write cost.

## 6. Other queries worth showing

The analytical suite in
[`database/queries/demo_analytical_queries.sql`](../database/queries/demo_analytical_queries.sql)
shows multi-table joins, `GROUP BY ... HAVING`, a correlated subquery, CTEs
and window functions (`ROW_NUMBER`, `LAG`, running `MAX`).
