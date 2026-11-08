import { GOALS, type Goal } from '@/types/database';

export interface GoalPlan {
  /** What is saved in users.goal; fn_calorie_target turns it into the daily calories */
  goal: Goal;
  title: string;
  blurb: string;
  /** The calorie rule that `goal` really applies, e.g. "+300 kcal surplus" */
  calories: string;
}

const calories = (goal: Goal) => GOALS.find((g) => g.value === goal)!.blurb;
const plan = (goal: Goal, title: string, blurb: string): GoalPlan => ({ goal, title, blurb, calories: calories(goal) });

/**
 * Onboarding lets a member tick several goals, but the database stores one
 * (users.goal drives fn_calorie_target). Each combination maps to the stored goal
 * whose calorie rule fits it, so the screen only promises what the app will do.
 */
export function blendGoals(selected: Goal[]): GoalPlan {
  const muscle = selected.includes('hypertrophy');
  const strength = selected.includes('strength');
  const fatLoss = selected.includes('fat_loss');

  if (muscle && strength && fatLoss) return plan('maintenance', 'All-round', 'Slow, steady progress on all three: train for size and strength while eating at maintenance.');
  if (muscle && fatLoss) return plan('maintenance', 'Body recomposition', 'Build muscle and lose fat at the same time by eating at maintenance with high protein.');
  if (strength && fatLoss) return plan('fat_loss', 'Strength cut', 'Lose fat in a calorie deficit while heavy lifts protect your strength.');
  if (muscle && strength) return plan('hypertrophy', 'Powerbuilding', 'Grow muscle and push your big lifts in a calorie surplus.');

  const single = GOALS.find((g) => g.value === selected[0]) ?? GOALS[0];
  return plan(single.value, single.label, single.blurb);
}
