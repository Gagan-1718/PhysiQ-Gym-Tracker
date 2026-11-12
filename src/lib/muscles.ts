/** Muscles an exercise works (exercise_muscles, migration 003), as shown on the guided workout. */
export interface MuscleHit {
  code: string;
  role: 'primary' | 'secondary';
  label?: string;
}

/** When an exercise has no rows in exercise_muscles, show its muscle group instead. */
const GROUP_REGIONS: Record<string, string[]> = {
  Chest: ['chest'],
  Back: ['lats'],
  Shoulders: ['front_delts', 'side_delts'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Quads: ['quads'],
  Hamstrings: ['hamstrings'],
  Glutes: ['glutes'],
  Calves: ['calves'],
  Core: ['abs'],
};

export const REGION_LABELS: Record<string, string> = {
  chest: 'Chest',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  lats: 'Lats',
  traps: 'Traps',
  lower_back: 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

export function musclesFor(muscles: MuscleHit[] | null | undefined, muscleGroup: string): MuscleHit[] {
  // Main muscles first, then the helpers
  if (muscles && muscles.length > 0) return [...muscles].sort((a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1));
  return (GROUP_REGIONS[muscleGroup] ?? []).map((code) => ({ code, role: 'primary' as const }));
}

export const muscleName = (m: MuscleHit) => m.label ?? REGION_LABELS[m.code] ?? m.code;
