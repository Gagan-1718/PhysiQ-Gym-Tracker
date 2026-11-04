import { z } from 'zod';
import { ok, route } from '@/lib/api';
import { callRows } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { RepMaxRow } from '@/types/database';

const QuerySchema = z.object({
  weight: z.coerce.number().gt(0, 'weight must be above 0').max(999.99),
  reps: z.coerce.number().int().min(1).max(30),
});

// GET /api/calc/one-rep-max?weight=100&reps=10
// Everything is computed by the database: CALL sp_rep_max_table (Epley via fn_calculate_1rm
// and a recursive CTE for the 1..12 rep table). Needs a session only to keep the API closed.
export const GET = route(async (req) => {
  await requireUser();
  const params = new URL(req.url).searchParams;
  const q = QuerySchema.parse({ weight: params.get('weight'), reps: params.get('reps') });
  const rows = await callRows<RepMaxRow>('sp_rep_max_table', [q.weight, q.reps]);
  return ok({ oneRm: rows[0]?.one_rm ?? 0, table: rows });
});
