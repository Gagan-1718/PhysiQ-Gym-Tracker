import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** An error whose message is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

type DbError = Error & { code?: string | number; sqlMessage?: string };

/**
 * Translate database errors into HTTP responses. Business rules enforced by
 * the database (CHECK constraints, SIGNAL in triggers, unique keys) surface as
 * 4xx with a readable message instead of a generic 500.
 */
function toResponse(err: unknown) {
  // Next.js signals "this route is dynamic" (it reads cookies/headers) by throwing; that is
  // framework control flow, not a failure, so it must never be turned into a response.
  if ((err as { digest?: string } | null)?.digest === 'DYNAMIC_SERVER_USAGE') throw err;
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue?.path.join('.');
    return NextResponse.json({ error: field ? `${field}: ${issue.message}` : 'Invalid request' }, { status: 400 });
  }
  const dbErr = err as DbError;
  switch (dbErr?.code) {
    case 'ER_SIGNAL_EXCEPTION': // SIGNAL SQLSTATE '45000' from a trigger / procedure
      return NextResponse.json({ error: dbErr.sqlMessage ?? dbErr.message }, { status: 400 });
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return NextResponse.json({ error: 'A value is outside the allowed range.' }, { status: 400 });
    case 'ER_DUP_ENTRY':
      return NextResponse.json({ error: 'That already exists.' }, { status: 409 });
    case 'ER_ROW_IS_REFERENCED_2':
      return NextResponse.json({ error: 'It is still in use and cannot be deleted.' }, { status: 409 });
    case 'ER_NO_REFERENCED_ROW_2':
      return NextResponse.json({ error: 'A referenced record does not exist.' }, { status: 400 });
  }
  if (dbErr?.code === 11000) return NextResponse.json({ error: 'That name is already taken.' }, { status: 409 });
  if (dbErr?.code === 121) return NextResponse.json({ error: 'Document failed validation.' }, { status: 400 });
  if (dbErr?.code === 27) return NextResponse.json({ error: 'Search is not set up yet. Run npm run db:init.' }, { status: 503 });

  console.error('[api] unhandled error', err);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wrap a route handler with consistent error handling. */
export function route<C = { params: Record<string, string> }>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return toResponse(err);
    }
  };
}

export const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });

/**
 * Parse a JSON body; malformed JSON becomes a 400. Requiring the JSON content
 * type means a cross-site HTML form (text/plain, urlencoded) can never reach a
 * handler, on top of the SameSite=Lax session cookie.
 */
export async function readJson(req: Request): Promise<unknown> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'Send the request body as application/json.');
  }
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.');
  }
}
