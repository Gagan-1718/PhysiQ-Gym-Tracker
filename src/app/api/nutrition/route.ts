import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';

// GET: Fetch daily macro totals from view_daily_macro_totals + recent logs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId')) || 1;
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Daily totals aggregated through MySQL View
    const dailyTotals: any = await query(
      `SELECT * FROM view_daily_macro_totals 
       WHERE user_id = ? AND log_date = ?`,
      [userId, date]
    );

    // Itemized logs for the day
    const items: any = await query(
      `SELECT nl.id, nl.food_id, f.name AS food_name, nl.quantity, nl.meal_type,
              ROUND((nl.quantity / 100.0) * f.calories, 1) AS calories,
              ROUND((nl.quantity / 100.0) * f.protein, 1) AS protein,
              ROUND((nl.quantity / 100.0) * f.carbs, 1) AS carbs,
              ROUND((nl.quantity / 100.0) * f.fat, 1) AS fat
       FROM nutrition_logs nl
       JOIN foods f ON nl.food_id = f.id
       WHERE nl.user_id = ? AND nl.log_date = ?
       ORDER BY nl.id ASC`,
      [userId, date]
    );

    return NextResponse.json({
      success: true,
      data: {
        date,
        totals: dailyTotals[0] || {
          total_calories: 0,
          total_protein: 0,
          total_carbs: 0,
          total_fat: 0,
          meals_logged_count: 0,
        },
        items,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch nutrition data' },
      { status: 500 }
    );
  }
}

// POST: Log food intake
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId = 1, foodId, quantity, mealType = 'Snack', logDate } = body;

    if (!foodId || !quantity || !logDate) {
      return NextResponse.json(
        { success: false, error: 'Food ID, quantity, and log date are required' },
        { status: 400 }
      );
    }

    const result: any = await query(
      `INSERT INTO nutrition_logs (user_id, food_id, quantity, meal_type, log_date)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, foodId, quantity, mealType, logDate]
    );

    return NextResponse.json({
      success: true,
      message: 'Meal item logged successfully',
      data: { id: result.insertId },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to log meal item' },
      { status: 500 }
    );
  }
}
