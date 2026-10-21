'use client';

/** Client-side HTTP helpers shared by SWR reads and mutations. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new HttpError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

/** A failed fetch (no signal, server unreachable) is a TypeError with a cryptic message; make it readable. */
async function request(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new HttpError(0, 'No connection. Anything you were logging is still on this device. Try again when you are online.');
  }
}

/** SWR fetcher */
export const fetcher = async <T,>(url: string) => parse<T>(await request(url, { headers: { accept: 'application/json' } }));

/** JSON mutation helper */
export async function send<T = unknown>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await request(url, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res);
}
