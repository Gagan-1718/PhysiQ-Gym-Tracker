/*
 * Helpers for the API test suite. These tests talk to a RUNNING server
 * (npm run dev, or npm run build && npm start) that is connected to a database
 * freshly built with `npm run db:init`, so the demo accounts exist.
 *
 *   BASE_URL   default http://localhost:3000
 */
const crypto = require('crypto');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const DEMO_PASSWORD = 'physiq123';

/** A cookie-jar HTTP client for one signed-in (or anonymous) user. */
function client() {
  const jar = new Map();
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

  async function req(path, opts = {}) {
    const headers = { ...(opts.headers || {}), cookie: cookie() };
    if (typeof opts.body === 'string' && !headers['content-type']) headers['content-type'] = 'application/json';
    const res = await fetch(BASE + path, { redirect: 'manual', ...opts, headers });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
    const type = res.headers.get('content-type') || '';
    const body = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, body, headers: res.headers };
  }

  async function login(email, password = DEMO_PASSWORD) {
    const { body } = await req('/api/auth/csrf');
    await req('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: body.csrfToken, email, password, json: 'true' }),
    });
    const session = await req('/api/auth/session');
    if (!session.body.user) throw new Error(`Login failed for ${email}`);
    return session.body.user;
  }

  const json = (method, path, data) => req(path, { method, body: JSON.stringify(data) });
  return { req, login, get: (p) => req(p), post: (p, d) => json('POST', p, d), patch: (p, d) => json('PATCH', p, d), del: (p, d) => json('DELETE', p, d) };
}

async function signedIn(email) {
  const c = client();
  await c.login(email);
  return c;
}

/** Today as the server's local calendar date (the app stores local dates). */
function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A valid 1x1 PNG. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

/** A multipart upload body for POST /api/journey/photo. */
function photoForm({ bytes = PNG_1X1, name = 'p.png', type = 'image/png', date = today(), angle = 'front', caption = '', tags = '' } = {}) {
  const form = new FormData();
  form.set('file', new Blob([bytes], { type }), name);
  form.set('date', date);
  form.set('angle', angle);
  if (caption) form.set('caption', caption);
  if (tags) form.set('tags', tags);
  return form;
}

const uniqueEmail = (prefix = 'test') => `${prefix}-${crypto.randomUUID()}@physiq.test`;

module.exports = { BASE, DEMO_PASSWORD, client, signedIn, today, PNG_1X1, photoForm, uniqueEmail };
