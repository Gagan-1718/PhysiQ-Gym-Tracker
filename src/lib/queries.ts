import { callOut, select } from './mysql';
import type { Recommendation, SplitDayStatus } from '@/types/database';

/** Active split days with recovery status (view_split_day_status) and their muscle groups. */
export async function getSplitStatus(userId: number): Promise<SplitDayStatus[]> {
  const rows = await select<Omit<SplitDayStatus, 'muscles'> & { muscles: string | null }>(
    `SELECT v.split_id, v.split_name, v.split_day_id, v.body_part, v.day_order, v.min_rest_days,
            v.last_trained_date, v.days_since, v.status, v.days_until_ready, v.priority_rank,
            (SELECT GROUP_CONCAT(mg.name ORDER BY mg.id SEPARATOR ',')
               FROM split_day_muscles sdm
               JOIN muscle_groups mg ON mg.id = sdm.muscle_group_id
              WHERE sdm.split_day_id = v.split_day_id) AS muscles
     FROM view_split_day_status v
     WHERE v.user_id = ?
     ORDER BY v.day_order`,
    [userId]
  );
  return rows.map((r) => ({ ...r, muscles: r.muscles ? r.muscles.split(',') : [] }));
}

/** Adaptive recommendation from the stored procedure sp_get_next_body_part. */
export async function getRecommendation(userId: number): Promise<Recommendation> {
  const out = await callOut<{ split_day_id: number | null; body_part: string; days_since: number | null; status: string }>(
    'sp_get_next_body_part',
    [userId],
    ['split_day_id', 'body_part', 'days_since', 'status']
  );
  return {
    split_day_id: out.split_day_id === null ? null : Number(out.split_day_id),
    body_part: out.body_part,
    days_since: out.days_since === null ? null : Number(out.days_since),
    status: out.status as Recommendation['status'],
  };
}
