import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';

// GET: Fetch analytics summary (Weekly view, PRs, body weight progression)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId')) || 1;

    // 1. Weekly training summary view
    const weeklySummary = await query(
      `SELECT * FROM view_weekly_summary 
       WHERE user_id = ? 
       ORDER BY workout_year DESC, workout_week DESC 
       LIMIT 8`,
      [userId]
    );

    // 2. Detailed Personal Records view
    const prs = await query(
      `SELECT * FROM view_personal_records_detailed 
       WHERE user_id = ? 
       ORDER BY achieved_on DESC 
       LIMIT 10`,
      [userId]
    );

    // 3. Body measurements history
    const measurements = await query(
      `SELECT id, weight, waist, chest, arms, recorded_on 
       FROM body_measurements 
       WHERE user_id = ? 
       ORDER BY recorded_on ASC 
       LIMIT 20`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      data: {
        weeklySummary,
        personalRecords: prs,
        measurements,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
