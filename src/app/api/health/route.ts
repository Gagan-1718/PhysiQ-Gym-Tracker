import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';
import { getMongoDB } from '@/lib/mongodb';

export async function GET() {
  const healthStatus: {
    status: string;
    timestamp: string;
    mysql: { connected: boolean; tablesCount?: number; error?: string };
    mongodb: { connected: boolean; collectionsCount?: number; error?: string };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mysql: { connected: false },
    mongodb: { connected: false },
  };

  // Test MySQL connection & count tables
  try {
    const tables = await query<any[]>('SHOW TABLES');
    healthStatus.mysql = {
      connected: true,
      tablesCount: tables ? tables.length : 0,
    };
  } catch (err: any) {
    healthStatus.mysql = {
      connected: false,
      error: err.message || 'Failed to query MySQL database',
    };
  }

  // Test MongoDB connection
  try {
    const db = await getMongoDB();
    const collections = await db.listCollections().toArray();
    healthStatus.mongodb = {
      connected: true,
      collectionsCount: collections.length,
    };
  } catch (err: any) {
    healthStatus.mongodb = {
      connected: false,
      error: err.message || 'Failed to connect to MongoDB',
    };
  }

  return NextResponse.json(healthStatus);
}
