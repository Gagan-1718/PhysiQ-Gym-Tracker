/** Mood scale shared by the finish sheet, the journey timeline and the add-note sheet. */
export const MOODS = [
  { value: 1, emoji: '😫', label: 'Drained' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '🙂', label: 'Solid' },
  { value: 4, emoji: '😀', label: 'Strong' },
  { value: 5, emoji: '🔥', label: 'On fire' },
] as const;

export const moodOf = (value: number | null) => MOODS.find((m) => m.value === value) ?? null;
