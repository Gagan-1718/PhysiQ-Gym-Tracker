import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { ApiError } from './api';
import type { UserRole } from '@/types/database';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

/** The signed-in user, or a 401. All data access is scoped by this id, never by a client-sent id. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) throw new ApiError(401, 'Please sign in.');
  return { id: user.id, name: user.name ?? '', email: user.email ?? '', role: user.role };
}

/** The signed-in admin, or a 401 / 403. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new ApiError(403, 'Admins only.');
  return user;
}
