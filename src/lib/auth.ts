import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { selectOne } from './mysql';
import type { UserRole } from '@/types/database';

// A precomputed hash so that unknown emails cost the same time as wrong passwords
// (prevents discovering which emails are registered by timing the response).
const DUMMY_HASH = '$2a$10$tvEaJlUNMX8eOuW5rgrRRuMZUAJLcxRcz3lQoKVgZ3SxVCQYdbQLK';

// Simple in-memory brute-force guard: 8 failed attempts per email per 15 minutes.
const FAILED_LIMIT = 8;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

function tooManyFailures(email: string) {
  const entry = failures.get(email);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(email);
    return false;
  }
  return entry.count >= FAILED_LIMIT;
}

function recordFailure(email: string) {
  const entry = failures.get(email);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(email, { count: 1, first: Date.now() });
  else entry.count += 1;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? '';
        if (!email || !password) return null;
        if (tooManyFailures(email)) throw new Error('Too many attempts. Try again in a few minutes.');

        const user = await selectOne<UserRow>(
          'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
          [email]
        );
        const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
        if (!user || !valid) {
          recordFailure(email);
          return null;
        }
        failures.delete(email);
        return { id: String(user.id), name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = Number(user.id);
        token.role = user.role ?? 'member';
      }
      // Profile edits call useSession().update({ name }) to refresh the token
      if (trigger === 'update' && typeof session?.name === 'string') token.name = session.name;
      return token;
    },
    async session({ session, token }) {
      session.user = { ...session.user, id: token.uid, role: token.role };
      return session;
    },
  },
};
