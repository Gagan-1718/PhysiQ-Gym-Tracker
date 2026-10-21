# Viva demo guide

Everything here was rehearsed on a freshly built database. The numbers quoted
below are the ones you will see after `npm run db:reset`.

## 0. Before the viva (10 minutes, do it the day before and again an hour before)

| | Command / action | Why |
|---|---|---|
| 1 | Start the **MySQL80** and **MongoDB** services | both stores are required |
| 2 | `npm run db:reset` | **seed dates are relative to the day the database is built.** Without a fresh reset the statuses drift (e.g. Legs also becomes overdue after a few days) and the numbers below will not match |
| 3 | `npm run build` then `npm start`, open http://localhost:3000 | the production build is faster and cleaner than `npm run dev` |
| 4 | Log in as `alex@physiq.test` (password `physiq123`) in a phone-sized window (browser dev tools, 390 px) and `admin@physiq.test` in a second window | member and admin roles |
| 5 | MySQL Workbench: open `database/queries/viva_demo.sql` | all SQL for the demo, section by section |
| 6 | A terminal in the repo: ready to run `npm run viva:mongo` | MongoDB half of the demo |
| 7 | Have these open as tabs: `docs/diagrams/er-diagram.png`, `docs/diagrams/architecture.png`, GitHub Actions page of the repo | diagrams and CI |

Check: `npm test` should print **39 + 32 passing** (the API tests need the app running).

After the demo: `npm run db:reset` again.

---

## 1. The 5-minute script

| Time | Show | Say |
|---|---|---|
| 0:00–0:40 | `architecture.png`, then `er-diagram.png` | "PhysiQ is database-driven. **MySQL is the system of record** (12 tables, 3NF, 11 triggers, 14 procedures and functions, 5 views). **MongoDB** holds flexible documents: journals, notes, routines. The app only displays what the databases decide." |
| 0:40–1:20 | Today screen (member). Workbench section 2 | "The app recommends **Pull, overdue**, because `view_split_day_status` ranks split days by recovery: never trained, overdue, ready, recovering. `sp_get_next_body_part` takes rank 1. No fixed weekdays: miss a day and it adapts." |
| 1:20–2:10 | Workbench **section 3** (run it *before* you finish anything in the app) | "A workout is one **ACID transaction**. Watch: after the inserts the triggers have already set the session volume (2255), found a **new PR** (135 × 9, e1RM 175.5 beats 173.33) and marked Pull as trained. Then `ROLLBACK`: nothing is kept." |
| 2:10–3:20 | App: tap **Start Pull**. Tick the warm-up and set 1. Set set 2 to **135 kg × 9**: a **PR** badge appears. Tick it, **Finish** | "Same thing from the app. Every set was pre-filled by `sp_estimate_next_target`: last time 130 × 10, so the target is 132.5 × 8. This time the transaction is kept, and the success screen shows the volume and PRs read back from MySQL." |
| 3:20–3:50 | Progress → Strength; Workbench section 4 | "`fn_calculate_1rm` is the Epley formula, deterministic, in the database. The trend chart reads `view_exercise_session_best`." |
| 3:50–4:30 | Progress → Journey, then `npm run viva:mongo` | "**Polyglot persistence.** Journals and notes are documents with sparse fields. Mongo gives a **validator** (invalid mood rejected), a **text index**, a **compound index** that serves the feed with no sort, and an **aggregation** with `$facet`. A story points at the MySQL session by id and the app joins them." |
| 4:30–4:50 | Today rings: tap **+25 g**; admin window → Audit log | "Fuel targets come from body weight through `sp_get_daily_fuel`. Library changes by admins are written by a **trigger** that knows who acted." |
| 4:50–5:00 | Show `QUERY_PERFORMANCE_EXPLAIN.md` (or run `explain_benchmark.sql`) | "Composite index: **7 rows in 0.07 ms** versus a full scan of **60,019 rows in 27.5 ms**." |

This is tight. To save time, skip the ER diagram, or show Strength only briefly.
**Finishing the workout in the app saves it**: Pull is then trained and the PR is 135 × 9. If you want to repeat the demo, run `npm run db:reset`.

---

## 2. The 24-step walkthrough (use this for a longer slot or to answer "show me")

### A. Architecture and design
1. **Architecture diagram** (`docs/diagrams/architecture.png`). Browser → route handlers → MySQL (ACID) and MongoDB (documents). Photos on private disk. Two stores cooperate through ids.
2. **ER diagram** (`docs/diagrams/er-diagram.png`, generated from the live schema by `npm run docs:er`). 12 tables, 15 foreign keys. Point out `personal_records.set_id` (unique, one-to-one with `sets`).
3. **Normalisation** (`docs/DATABASE_DESIGN.md` §3). 1NF → BCNF. Two **documented denormalised caches**: `split_days.last_trained_date` and `workout_sessions.total_volume`, both maintained by triggers and covered by tests.

### B. Relational features (Workbench, `viva_demo.sql`)
4. **Section 1.** Counts: 12 tables, 5 views, 11 triggers, 14 routines, 19 CHECK constraints, 15 foreign keys.
5. **Constraints** (end of the file, run one at a time): a set with 0 reps → `chk_sets_reps`; a future workout → trigger `SIGNAL`; a second active split → unique index on a generated column; deleting a trained exercise → `ON DELETE RESTRICT`.
6. **Section 2.** The view and `sp_get_next_body_part` choose Pull. Explain the status rule: overdue = rest window + 2 days.
7. **Section 3.** The live transaction. Show **before**, **inside**, **after rollback**: volume 2255 and PR 135 × 9 appear by trigger, and vanish on `ROLLBACK`.
8. **Section 4.** `sp_estimate_next_target` (132.5 kg × 8, with its rationale) and `fn_calculate_1rm`.

### C. Server-side logic
9. **Triggers.** Open `database/triggers.sql`. Point at the session-delete trigger: *foreign-key cascades do not fire triggers*, so deleting a session rebuilds PRs explicitly.
10. **Procedures.** `sp_rebuild_personal_records` uses `ROW_NUMBER()`.
11. **Section 5.** Fuel: `sp_get_daily_fuel`, `sp_log_fuel` (clamped, never negative). Targets: 2 g protein/kg, 40 ml water/kg.
12. **Section 6.** Audit trail: a trigger records who changed the exercise library (`@app_user_id`).
13. **Section 7.** Analytical SQL: window functions (running `MAX`), and the **gaps-and-islands** streak.
14. **`demo_analytical_queries.sql`.** CTEs, `LAG`, correlated subquery, anti-join.

### D. The application
15. **Today.** Overdue banner, Up Next, rings, recovery per day. Tap **+25 g**: the ring moves instantly, then the database's clamped value replaces it.
16. **Start Pull** (do this *after* step 7, because Finish saves the workout). Pre-filled sets, big steppers, a **rest timer** after each tick, a **PR badge** on 135 × 9, and the screen is kept awake where the browser supports it.
17. **Reload the page mid-workout.** The workout survives (device draft); only **Finish** writes to the database.
18. **Finish.** Mood and tags (MongoDB), success screen with volume and PRs *read back from MySQL*.
19. **Double-tap Finish / retry.** `UNIQUE (user_id, client_ref)` returns the saved workout instead of a duplicate.
20. **Roles.** Member vs admin: the admin window edits the exercise library; a member's request to the same endpoint answers **403**. Every query is scoped by the *session* user id, never a client-sent one.

### E. NoSQL
21. **`npm run viva:mongo`.** Validator rejects `mood: 9` and a bad date; list of indexes; the plan `LIMIT → FETCH → IXSCAN (idx_user_timeline)` examines only the documents it returns.
22. **Text search and `$facet`.** Search "deadlift"; one pipeline returns counts per kind, mood by week and top tags.
23. **Progress photos.** (Optional live: Progress → Journey → Add → Progress photo.) Resized on the phone with location data stripped, stored privately, weight snapshot read from MySQL by `fn_current_weight`; another member cannot open the URL (404).

### F. Quality
24. **CI and tests.** `npm test` (39 DB + 32 API tests); the GitHub Actions run builds both databases from the repo files on a clean machine and passes. `QUERY_PERFORMANCE_EXPLAIN.md` has the measured index results.

---

## 3. Questions you may be asked

**Why 3NF, and why are there cached columns?**
Everything is in 3NF (`personal_records` in BCNF). Two derived values are cached on purpose, because the dashboard reads them constantly: `last_trained_date` and `total_volume`. Triggers keep them correct on insert, update and delete; tests prove it. This is documented as controlled denormalisation, not an accident.

**Why MySQL *and* MongoDB?**
Workouts are relational and transactional: a session without its sets would corrupt history. Journals, notes and routines are sparse, nested and read as whole units; in SQL they would be wide mostly-NULL tables or extra join tables. Each store does what it is best at.

**What if MySQL commits but MongoDB is down?**
The workout is safe. MongoDB writes happen after the MySQL commit and are best-effort; the API returns a warning. MySQL is the system of record.

**How do you keep ids across the two databases valid?**
No database can enforce a foreign key across stores, so the API checks MySQL ids before writing documents (for example routine exercise ids), and account deletion removes both sides.

**Show that it is ACID.**
Section 3 of `viva_demo.sql`: a transaction with trigger side effects that is rolled back leaves nothing. In the app: a workout with an invalid set (unknown exercise) answers 400 and **no session header survives** (`tests/api/workouts.test.js`).

**What happens if two devices submit the same workout?**
`UNIQUE (user_id, client_ref)`: the second gets the first one's result.

**Why triggers instead of application code?**
Any client (the app, Workbench, a script) gets the same behaviour; the rules cannot be bypassed or forgotten.

**Why is the index column order `(user_id, session_date DESC)`?**
Equality column first, then the range and sort column. MySQL seeks to the member, reads the date range already in order, and needs no sort. The reverse order could not seek on the member.

**Why did EXPLAIN show a table scan on the demo data?**
With about 20 rows a scan is cheaper than an index seek and MySQL correctly picks it. The 60,000-row benchmark (`explain_benchmark.sql`) shows the index being used: 7 rows vs 60,019.

**How are passwords and sessions protected?**
bcrypt (10 rounds), a constant-time path for unknown emails, a per-email brute-force limit, JWT session in an HTTP-only cookie. All SQL is parameterised; `multipleStatements` is off.

**How do you prevent one member reading another's data?**
Every query takes the user id from the server-side session. Photos are served from a folder chosen by the session user id; another member's file name returns 404 (tested).

**What are the limitations?** (say them before you are asked)
- Notifications appear when the app is opened or returns to the foreground (once a day). True background push needs a push server, which is not part of this project.
- Photos are stored on the server's disk, not in cloud storage.
- No email verification or password reset.
- Single-node databases; no replication or backups are configured.
- Seed dates are relative, so the demo database must be rebuilt (`npm run db:reset`) before each demonstration.

---

## 4. If something goes wrong

| Symptom | Fix |
|---|---|
| Statuses or numbers differ from this guide | `npm run db:reset`, restart the app |
| Login fails | demo password is `physiq123`; check `NEXTAUTH_SECRET` is set in `.env` |
| `/api/health` shows degraded | the MySQL or MongoDB Windows service is stopped |
| Port 3000 busy | stop the old server (`netstat -ano \| findstr :3000`) |
| Workbench says access denied | use the root password from your `.env` |
