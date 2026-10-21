/**
 * Shared layout for one set: [badge] [weight] [reps] [action], used by the live logger and by edit mode
 * of a saved workout. On phones narrower than 380px, side by side leaves the numbers too narrow to read or
 * tap (WCAG 2.5.8 wants 24px), so weight and reps stack on two lines between the badge and the action.
 */
export const SET_ROW =
  'grid grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5 max-[379px]:grid-cols-[2.25rem_minmax(0,1fr)_2.75rem]';

export const SET_BADGE = 'max-[379px]:col-start-1 max-[379px]:row-span-2';
export const SET_WEIGHT = 'min-w-0 max-[379px]:col-start-2 max-[379px]:row-start-1';
export const SET_REPS = 'min-w-0 max-[379px]:col-start-2 max-[379px]:row-start-2';
export const SET_ACTION = 'max-[379px]:col-start-3 max-[379px]:row-start-1 max-[379px]:row-span-2';
