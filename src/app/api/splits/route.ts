import { NextResponse } from 'next/server';
import { query, getMySQLPool } from '@/lib/mysql';

// GET: Retrieve user's active split + next recommended body part via Stored Procedure
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId')) || 1;

    // 1. Fetch active split and its scheduled days
    const splitRows: any = await query(
      `SELECT s.id AS split_id, s.split_name, sd.id AS day_id, sd.body_part, sd.day_order, sd.last_trained_date
       FROM splits s
       JOIN split_days sd ON s.id = sd.split_id
       WHERE s.user_id = ? AND s.is_active = TRUE
       ORDER BY sd.day_order ASC`,
      [userId]
    );

    // 2. Call Stored Procedure for Adaptive Recommendation
    const pool = getMySQLPool();
    const [procResults]: any = await pool.query(
      `CALL sp_get_next_body_part(?, @rec_part, @days_overdue); 
       SELECT @rec_part AS recommended_body_part, @days_overdue AS days_since_last_trained;`,
      [userId]
    );

    const recommendation = procResults && procResults[1] && procResults[1][0]
      ? procResults[1][0]
      : { recommended_body_part: 'Full Body', days_since_last_trained: 0 };

    return NextResponse.json({
      success: true,
      data: {
        splitName: splitRows.length > 0 ? splitRows[0].split_name : 'No Active Split',
        days: splitRows,
        recommendation,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch split data' },
      { status: 500 }
    );
  }
}

// POST: Create or update a training split with split_days
export async function POST(request: Request) {
  const pool = getMySQLPool();
  const connection = await pool.getConnection();

  try {
    const body = await request.json();
    const { userId = 1, splitName, days = [] } = body;

    if (!splitName || !days.length) {
      return NextResponse.json(
        { success: false, error: 'Split name and at least one day are required' },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    // Deactivate previous splits
    await connection.execute(
      `UPDATE splits SET is_active = FALSE WHERE user_id = ?`,
      [userId]
    );

    // Insert new split
    const [splitResult]: any = await connection.execute(
      `INSERT INTO splits (user_id, split_name, is_active) VALUES (?, ?, TRUE)`,
      [userId, splitName]
    );
    const splitId = splitResult.insertId;

    // Insert split days
    for (let i = 0; i < days.length; i++) {
      await connection.execute(
        `INSERT INTO split_days (split_id, body_part, day_order) VALUES (?, ?, ?)`,
        [splitId, days[i].bodyPart, i + 1]
      );
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: 'Split created and activated successfully',
      data: { splitId },
    });
  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save split' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
