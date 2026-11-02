import { ok, route } from '@/lib/api';
import { select } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { OverdueAlert } from '@/types/database';

// GET /api/alerts — split days that are overdue, worst first.
// "Overdue" is defined once, inside view_split_day_status: the day's recovery
// window (min_rest_days) plus 2 days. The app never re-implements that rule.
export const GET = route(async () => {
  const me = await requireUser();
  const alerts = await select<OverdueAlert>(
    `SELECT split_day_id, body_part, days_since, last_trained_date, min_rest_days
     FROM view_split_day_status
     WHERE user_id = ? AND status = 'overdue'
     ORDER BY days_since DESC, day_order`,
    [me.id]
  );
  return ok({ alerts });
});
