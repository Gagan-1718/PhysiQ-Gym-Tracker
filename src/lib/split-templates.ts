/** Starter splits offered during onboarding and in Profile. */
export interface SplitTemplate {
  id: string;
  name: string;
  blurb: string;
  minRestDays: number;
  days: { label: string; muscles: string[] }[];
}

const UPPER = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'];
const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    blurb: 'The classic 3-day rotation. Each day every 3–4 days.',
    minRestDays: 2,
    days: [
      { label: 'Push', muscles: ['Chest', 'Shoulders', 'Triceps'] },
      { label: 'Pull', muscles: ['Back', 'Biceps'] },
      { label: 'Legs', muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'] },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    blurb: 'Two days, high frequency. Great for 4 sessions a week.',
    minRestDays: 2,
    days: [
      { label: 'Upper', muscles: UPPER },
      { label: 'Lower', muscles: LOWER },
    ],
  },
  {
    id: 'arnold',
    name: 'Arnold Split',
    blurb: 'Chest & back, shoulders & arms, legs.',
    minRestDays: 2,
    days: [
      { label: 'Chest & Back', muscles: ['Chest', 'Back'] },
      { label: 'Shoulders & Arms', muscles: ['Shoulders', 'Biceps', 'Triceps'] },
      { label: 'Legs', muscles: LOWER },
    ],
  },
  {
    id: 'bro',
    name: 'Bro Split',
    blurb: 'One muscle group a day, each trained once a week.',
    minRestDays: 5,
    days: [
      { label: 'Chest', muscles: ['Chest'] },
      { label: 'Back', muscles: ['Back'] },
      { label: 'Shoulders', muscles: ['Shoulders'] },
      { label: 'Arms', muscles: ['Biceps', 'Triceps'] },
      { label: 'Legs', muscles: LOWER },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body',
    blurb: 'Everything, alternating A and B. Ideal for 2–3 days a week.',
    minRestDays: 1,
    days: [
      { label: 'Full Body A', muscles: [...UPPER, ...LOWER] },
      { label: 'Full Body B', muscles: [...UPPER, ...LOWER] },
    ],
  },
];
