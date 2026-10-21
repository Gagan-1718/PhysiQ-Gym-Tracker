import { ok, route } from '@/lib/api';
import { select, selectOne } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { PersonalRecord, WeeklySummary } from '@/types/database';

// GET /api/progress — dashboard + overview data, all from views
export const GET = route(async () => {
  const me = await requireUser();

  const [weeks, muscles, prs, streak, goal] = await Promise.all([
    // Last 8 ISO weeks (view_weekly_summary)
    select<WeeklySummary>(
      `SELECT week_start, sessions_completed, total_volume, working_sets, minutes_trained, body_parts_trained
       FROM view_weekly_summary
       WHERE user_id = ? AND week_start >= DATE_SUB(DATE_SUB(CURRENT_DATE, INTERVAL WEEKDAY(CURRENT_DATE) DAY), INTERVAL 7 WEEK)
       ORDER BY week_start`,
      [me.id]
    ),
    // Working sets per muscle, this week vs last week (view_weekly_muscle_volume)
    select<{ muscle_group: string; this_week: number; last_week: number }>(
      `SELECT mg.name AS muscle_group,
              COALESCE(SUM(CASE WHEN v.week_start = DATE_SUB(CURRENT_DATE, INTERVAL WEEKDAY(CURRENT_DATE) DAY) THEN v.working_sets END), 0) AS this_week,
              COALESCE(SUM(CASE WHEN v.week_start = DATE_SUB(CURRENT_DATE, INTERVAL WEEKDAY(CURRENT_DATE) + 7 DAY) THEN v.working_sets END), 0) AS last_week
       FROM muscle_groups mg
       LEFT JOIN view_weekly_muscle_volume v ON v.muscle_group_id = mg.id AND v.user_id = ?
       GROUP BY mg.id, mg.name
       ORDER BY mg.id`,
      [me.id]
    ),
    select<PersonalRecord>(
      `SELECT exercise_id, exercise_name, muscle_group, weight, reps, estimated_1rm, achieved_on, session_id
       FROM view_personal_records_detailed WHERE user_id = ?
       ORDER BY achieved_on DESC, estimated_1rm DESC LIMIT 6`,
      [me.id]
    ),
    // Gaps-and-islands: consecutive weeks with at least one session.
    // week index - ROW_NUMBER() is constant inside an unbroken run of weeks.
    selectOne<{ streak_weeks: number; last_week: string }>(
      `WITH active AS (
         SELECT DISTINCT week_start FROM view_weekly_summary WHERE user_id = ?
       ), runs AS (
         SELECT week_start,
                DATEDIFF(week_start, '2000-01-03') DIV 7 - ROW_NUMBER() OVER (ORDER BY week_start) AS run_id
         FROM active
       )
       SELECT COUNT(*) AS streak_weeks, MAX(week_start) AS last_week
       FROM runs GROUP BY run_id ORDER BY last_week DESC LIMIT 1`,
      [me.id]
    ),
    selectOne<{ weekly_goal: number; this_week_start: string }>(
      `SELECT weekly_goal, DATE_SUB(CURRENT_DATE, INTERVAL WEEKDAY(CURRENT_DATE) DAY) AS this_week_start FROM users WHERE id = ?`,
      [me.id]
    ),
  ]);

  const thisWeekStart = goal?.this_week_start ?? '';
  const lastWeekStart = (() => {
    const d = new Date(`${thisWeekStart}T00:00:00`);
    d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  // A streak is alive if its latest week is this week or last week
  const alive = streak && (streak.last_week === thisWeekStart || streak.last_week === lastWeekStart);

  return ok({
    weeklyGoal: goal?.weekly_goal ?? 4,
    thisWeekStart,
    weeks,
    thisWeek: weeks.find((w) => w.week_start === thisWeekStart) ?? null,
    muscles,
    prs,
    streakWeeks: alive ? streak.streak_weeks : 0,
  });
});
