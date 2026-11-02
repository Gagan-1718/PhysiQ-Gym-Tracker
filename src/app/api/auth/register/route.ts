import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ApiError, ok, readJson, route } from '@/lib/api';
import { execute, selectOne } from '@/lib/mysql';

const RegisterSchema = z.object({
  name: z.string().trim().min(2, 'at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('enter a valid email').max(150),
  password: z.string().min(8, 'at least 8 characters').max(72, 'at most 72 characters'), // bcrypt limit
});

// POST /api/auth/register — create a member account (admins are created in the database)
export const POST = route(async (req) => {
  const body = RegisterSchema.parse(await readJson(req));

  const existing = await selectOne('SELECT id FROM users WHERE email = ?', [body.email]);
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  const passwordHash = await bcrypt.hash(body.password, 10);
  const result = await execute(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'member')",
    [body.name, body.email, passwordHash]
  );
  return ok({ id: result.insertId }, 201);
});
