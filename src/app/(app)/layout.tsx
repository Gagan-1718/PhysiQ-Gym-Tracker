import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { selectOne } from '@/lib/mysql';
import { AppShell } from '@/components/shell/AppShell';

/** Signed-in area. New members are sent to onboarding until they pick a split;
 *  admins manage the library and are not forced to have one. A member who has not
 *  seen the app tour yet (users.tour_completed_at IS NULL) gets it on Today. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const account = await selectOne<{ has_split: number; role: string; tour_pending: number }>(
    `SELECT u.role, u.tour_completed_at IS NULL AS tour_pending,
            EXISTS (SELECT 1 FROM splits s WHERE s.user_id = u.id AND s.is_active) AS has_split
     FROM users u WHERE u.id = ?`,
    [session.user.id]
  );
  if (!account) redirect('/login?stale=1'); // token outlived the account
  if (!account.has_split && account.role !== 'admin') redirect('/onboarding');

  return <AppShell tour={account.role === 'member' && Boolean(account.tour_pending)}>{children}</AppShell>;
}
