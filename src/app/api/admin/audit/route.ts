import { ok, route } from '@/lib/api';
import { select } from '@/lib/mysql';
import { requireAdmin } from '@/lib/session';

// GET /api/admin/audit — latest library changes written by the trg_exercises_* triggers
export const GET = route(async () => {
  await requireAdmin();
  const rows = await select<{
    id: number;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    target_table: string;
    target_id: number;
    details: unknown;
    created_at: string;
    admin_name: string | null;
  }>(
    `SELECT a.id, a.action, a.target_table, a.target_id, a.details, a.created_at, u.name AS admin_name
     FROM admin_audit_logs a LEFT JOIN users u ON u.id = a.admin_id
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT 50`
  );
  return ok(rows);
});
