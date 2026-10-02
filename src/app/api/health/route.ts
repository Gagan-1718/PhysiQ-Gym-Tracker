import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';

export async function GET() {
  const healthStatus: {
    status: string;
    database: string;
    timestamp: string;
    mysql: { connected: boolean; tablesCount?: number; tables?: string[]; error?: string };
  } = {
    status: 'ok',
    database: 'MySQL 8.0+',
    timestamp: new Date().toISOString(),
    mysql: { connected: false },
  };

  try {
    const tables = await query<any[]>('SHOW TABLES');
    healthStatus.mysql = {
      connected: true,
      tablesCount: tables ? tables.length : 0,
      tables: tables ? tables.map(t => Object.values(t)[0] as string) : [],
    };
  } catch (err: any) {
    healthStatus.mysql = {
      connected: false,
      error: err.message || 'Failed to connect to MySQL database',
    };
  }

  return NextResponse.json(healthStatus);
}
