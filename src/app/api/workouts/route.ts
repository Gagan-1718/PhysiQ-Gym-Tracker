import { NextResponse } from 'next/server';
import { query, getMySQLPool } from '@/lib/mysql';

// GET: Fetch recent workout sessions with total volume and sets
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId')) || 1; // Default to user 1 for development
    const limit = Number(searchParams.get('limit')) || 10;

    const sessions = await query(
      `SELECT ws.id, ws.user_id, ws.session_date, ws.body_part, ws.total_volume, ws.notes,
              COUNT(s.id) AS set_count
       FROM workout_sessions ws
       LEFT JOIN sets s ON ws.id = s.session_id
       WHERE ws.user_id = ?
       GROUP BY ws.id
       ORDER BY ws.session_date DESC, ws.id DESC
       LIMIT ?`,
      [userId, limit]
    );

    return NextResponse.json({ success: true, data: sessions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch workouts' },
      { status: 500 }
    );
  }
}

// POST: Log a new workout session with multiple sets (Atomic MySQL Transaction)
export async function POST(request: Request) {
  const pool = getMySQLPool();
  const connection = await pool.getConnection();

  try {
    const body = await request.json();
    const { userId = 1, sessionDate, bodyPart, notes, sets = [] } = body;

    if (!sessionDate || !bodyPart || !sets.length) {
      return NextResponse.json(
        { success: false, error: 'Missing required session date, body part, or sets data' },
        { status: 400 }
      );
    }

    // Begin ACID Transaction
    await connection.beginTransaction();

    // 1. Insert Workout Session Header
    const [sessionResult]: any = await connection.execute(
      `INSERT INTO workout_sessions (user_id, session_date, body_part, total_volume, notes)
       VALUES (?, ?, ?, 0.00, ?)`,
      [userId, sessionDate, bodyPart, notes || null]
    );
    const sessionId = sessionResult.insertId;

    // 2. Insert Sets (Triggers will automatically update total_volume and last_trained_date)
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      await connection.execute(
        `INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          set.exerciseId,
          i + 1,
          set.reps,
          set.weight,
          Boolean(set.isWarmup),
          set.rpe || null,
        ]
      );

      // 3. Automated PR Verification for non-warmup sets
      if (!set.isWarmup) {
        await connection.query(
          `CALL sp_check_and_update_pr(?, ?, ?, ?, ?, @is_pr)`,
          [userId, set.exerciseId, set.weight, set.reps, sessionDate]
        );
      }
    }

    // Commit Transaction
    await connection.commit();

    return NextResponse.json({
      success: true,
      message: 'Workout session logged successfully',
      data: { sessionId },
    });
  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json(
      { success: false, error: error.message || 'Transaction failed. Rolled back.' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
