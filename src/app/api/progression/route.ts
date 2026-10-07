import { NextResponse } from 'next/server';
import { query, getMySQLPool } from '@/lib/mysql';

// GET: Estimate next target weight & reps using stored procedure sp_estimate_next_target
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId')) || 1;
    const exerciseId = Number(searchParams.get('exerciseId')) || 1;

    // 1. Fetch exercise info
    const exercises: any = await query(
      `SELECT id, name, muscle_group, equipment_needed FROM exercises WHERE id = ?`,
      [exerciseId]
    );

    if (!exercises.length) {
      return NextResponse.json(
        { success: false, error: 'Exercise not found' },
        { status: 404 }
      );
    }

    // 2. Execute Stored Procedure sp_estimate_next_target
    const pool = getMySQLPool();
    const [procResults]: any = await pool.query(
      `CALL sp_estimate_next_target(?, ?, @target_weight, @target_reps);
       SELECT @target_weight AS suggested_weight, @target_reps AS suggested_reps;`,
      [userId, exerciseId]
    );

    const recommendation = procResults && procResults[1] && procResults[1][0]
      ? procResults[1][0]
      : { suggested_weight: 20.0, suggested_reps: 10 };

    // 3. Fetch historical top sets for this exercise to show progression trend
    const history: any = await query(
      `SELECT ws.session_date, st.weight, st.reps, st.rpe,
              ROUND(st.weight * (1 + (st.reps / 30.0)), 1) AS estimated_1rm
       FROM sets st
       JOIN workout_sessions ws ON st.session_id = ws.id
       WHERE ws.user_id = ? AND st.exercise_id = ? AND st.is_warmup = FALSE
       ORDER BY ws.session_date DESC, st.weight DESC
       LIMIT 6`,
      [userId, exerciseId]
    );

    return NextResponse.json({
      success: true,
      data: {
        exercise: exercises[0],
        recommendation: {
          suggestedWeight: Number(recommendation.suggested_weight),
          suggestedReps: Number(recommendation.suggested_reps),
        },
        history,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to calculate progression target' },
      { status: 500 }
    );
  }
}
