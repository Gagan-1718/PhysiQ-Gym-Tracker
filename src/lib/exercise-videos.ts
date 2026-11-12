/**
 * Exercises with a looping demonstration video at public/exercise-videos/<media_key>.mp4.
 * Every other exercise plays its two-frame drawing. The list is kept here, rather than
 * probed at run time, so the browser never asks for a video that does not exist.
 */
const EXERCISE_VIDEOS: ReadonlySet<string> = new Set(['dumbbell-bicep-curl']);

export const hasExerciseVideo = (mediaKey: string | null | undefined): mediaKey is string => !!mediaKey && EXERCISE_VIDEOS.has(mediaKey);

export const exerciseVideoSrc = (mediaKey: string) => `/exercise-videos/${mediaKey}.mp4`;
