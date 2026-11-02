import { z } from 'zod';
import { EQUIPMENT } from '@/types/database';

/** Request schemas shared by more than one route. */
export const ExerciseSchema = z.object({
  name: z.string().trim().min(2).max(150),
  muscleGroupId: z.number().int().positive(),
  equipment: z.enum(EQUIPMENT as [string, ...string[]]),
  instructions: z.string().trim().max(1000).nullable().optional(),
});
