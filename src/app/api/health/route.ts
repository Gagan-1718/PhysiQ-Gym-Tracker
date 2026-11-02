import { NextResponse } from 'next/server';
import { callRows, select } from '@/lib/mysql';
import { getMongoDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Never prerender: this must reflect the databases at request time
export const dynamic = 'force-dynamic';

async function timed<T>(fn: () => Promise<T>) {
  const start = performance.now();
  try {
    const value = await fn();
    return { ok: true as const, latencyMs: Math.round((performance.now() - start) * 10) / 10, value };
  } catch (err) {
    return { ok: false as const, latencyMs: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// GET /api/health — liveness of both stores with round-trip latency.
// Anonymous callers only get the status; details need a signed-in user.
export async function GET() {
  const [mysql, mongo] = await Promise.all([
    timed(async () => {
      const [version] = await select<{ version: string }>('SELECT VERSION() AS version');
      // Counts come from a SECURITY DEFINER procedure: the least-privilege app account cannot read
      // every part of the system catalogue itself.
      const [stats] = await callRows<{ tables_count: number; views_count: number; triggers_count: number; routines_count: number }>('sp_schema_stats', []);
      return { version: version.version, tables: stats.tables_count, views: stats.views_count, triggers: stats.triggers_count, routines: stats.routines_count };
    }),
    timed(async () => {
      const db = await getMongoDb();
      await db.command({ ping: 1 });
      const collections = await db.listCollections({}, { nameOnly: true }).toArray();
      return { database: db.databaseName, collections: collections.map((c) => c.name).sort() };
    }),
  ]);

  const healthy = mysql.ok && mongo.ok;
  const status = healthy ? 'ok' : 'degraded';
  const signedIn = Boolean(await getServerSession(authOptions));
  return NextResponse.json(
    signedIn ? { status, timestamp: new Date().toISOString(), mysql, mongodb: mongo } : { status },
    { status: healthy ? 200 : 503 }
  );
}
