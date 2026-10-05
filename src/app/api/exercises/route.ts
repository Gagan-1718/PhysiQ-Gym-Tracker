import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';

// GET: Browse & filter exercises master library
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const muscleGroup = searchParams.get('muscleGroup');
    const search = searchParams.get('search');

    let sql = `SELECT * FROM exercises WHERE 1=1`;
    const params: any[] = [];

    if (muscleGroup && muscleGroup !== 'All') {
      sql += ` AND muscle_group = ?`;
      params.push(muscleGroup);
    }

    if (search) {
      sql += ` AND name LIKE ?`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY muscle_group ASC, name ASC`;

    const exercises = await query(sql, params);

    return NextResponse.json({ success: true, data: exercises });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch exercises' },
      { status: 500 }
    );
  }
}

// POST: Add new exercise to master library (Admin/Contributed)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, muscleGroup, equipmentNeeded, instructions } = body;

    if (!name || !muscleGroup) {
      return NextResponse.json(
        { success: false, error: 'Exercise name and muscle group are required' },
        { status: 400 }
      );
    }

    const result: any = await query(
      `INSERT INTO exercises (name, muscle_group, equipment_needed, instructions)
       VALUES (?, ?, ?, ?)`,
      [name, muscleGroup, equipmentNeeded || 'Bodyweight', instructions || null]
    );

    return NextResponse.json({
      success: true,
      message: 'Exercise added to library',
      data: { id: result.insertId },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to insert exercise' },
      { status: 500 }
    );
  }
}
