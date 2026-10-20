import { NextResponse } from 'next/server';
import { query, getMySQLPool } from '@/lib/mysql';

// GET: Fetch or initialize user daily fuel protocol for a given date
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId')) || 1;
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const pool = getMySQLPool();
    const [results]: any = await pool.query(
      `CALL sp_get_daily_fuel_protocol(?, ?);`,
      [userId, date]
    );

    const protocol = results && results[0] && results[0][0]
      ? results[0][0]
      : null;

    if (!protocol) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate fuel protocol' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: protocol.id,
        userId: protocol.user_id,
        date: protocol.log_date,
        proteinTargetG: Number(protocol.protein_target_g),
        waterTargetL: Number(protocol.water_target_l),
        calorieTarget: Number(protocol.calorie_target),
        proteinCompleted: Boolean(protocol.protein_completed),
        waterCompleted: Boolean(protocol.water_completed),
        sleepHours: Number(protocol.sleep_hours),
        notes: protocol.notes,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error fetching fuel protocol' },
      { status: 500 }
    );
  }
}

// POST: Update fuel protocol checklist (toggle protein, water, or sleep)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId = 1, date, proteinCompleted, waterCompleted, sleepHours } = body;

    const targetDate = date || new Date().toISOString().split('T')[0];

    await query(
      `UPDATE user_daily_fuel 
       SET protein_completed = COALESCE(?, protein_completed),
           water_completed = COALESCE(?, water_completed),
           sleep_hours = COALESCE(?, sleep_hours)
       WHERE user_id = ? AND log_date = ?`,
      [
        proteinCompleted !== undefined ? Boolean(proteinCompleted) : null,
        waterCompleted !== undefined ? Boolean(waterCompleted) : null,
        sleepHours !== undefined ? Number(sleepHours) : null,
        userId,
        targetDate,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Fuel checklist updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error updating fuel checklist' },
      { status: 500 }
    );
  }
}
