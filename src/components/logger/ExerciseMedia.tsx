'use client';

import { useEffect, useRef, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { exerciseVideoSrc, hasExerciseVideo } from '@/lib/exercise-videos';
import { cn } from '@/lib/format';

/**
 * Exercise demonstration. When the exercise has a video (public/exercise-videos/<key>.mp4,
 * one seamless rep made by scripts/prepare-exercise-video.js) it loops silently, filling
 * the screen. Otherwise the start and end
 * drawings (public/exercises/<key>/0.svg and 1.svg, everkinetic, CC BY-SA 4.0) fade back
 * and forth so the movement plays like a short animation; the black-on-white drawings are
 * inverted to white line art for the dark theme. Shows one still frame when the user
 * prefers reduced motion, and the muscle group when the exercise has no drawings
 * (media_key NULL).
 */
export function ExerciseMedia({
  mediaKey,
  name,
  muscle,
  still = false,
  fill = false,
  className,
}: {
  mediaKey: string | null | undefined;
  name: string;
  muscle?: string;
  /** A single frame, e.g. for small thumbnails in lists */
  still?: boolean;
  /** Fill the parent (which sets the size) instead of keeping a 3:2 box */
  fill?: boolean;
  className?: string;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = !still && !videoFailed && hasExerciseVideo(mediaKey);

  // Muted before playing, so mobile browsers allow the autoplay
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, [showVideo, mediaKey]);

  if (!mediaKey) {
    return (
      <div
        role="img"
        aria-label={`${name}: no demonstration`}
        className={cn('flex flex-col items-center justify-center gap-1 text-fg-3', fill ? 'h-full w-full' : 'aspect-[3/2] rounded-card bg-surface-2', className)}
      >
        <Dumbbell className="h-6 w-6" />
        {muscle && !still && <span className="text-footnote">{muscle}</span>}
      </div>
    );
  }
  const src = (frame: 0 | 1) => `/exercises/${mediaKey}/${frame}.svg`;

  if (showVideo) {
    return (
      <div role="img" aria-label={`${name} demonstration`} className={cn('relative overflow-hidden bg-black', fill ? 'h-full w-full' : 'aspect-[3/2] rounded-card', className)}>
        {/* Phones: the clip covers the whole screen (portrait, like the clip itself).
            Wide screens: the whole clip fits, its side edges fading into black. */}
        <video
          ref={videoRef}
          src={exerciseVideoSrc(mediaKey)}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          onError={() => setVideoFailed(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover object-[50%_30%] motion-reduce:hidden',
            fill ? 'md:static md:mx-auto md:block md:w-auto md:max-w-full md:object-contain md:video-fade-x' : 'object-contain'
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(0)} alt="" className="absolute inset-0 hidden h-full w-full object-contain p-1.5 invert motion-reduce:block" />
      </div>
    );
  }

  return (
    <div role="img" aria-label={`${name} demonstration`} className={cn('relative overflow-hidden', fill ? 'h-full w-full' : 'aspect-[3/2] rounded-card bg-black', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src(0)} alt="" loading={still ? 'lazy' : 'eager'} className={cn('absolute inset-0 h-full w-full object-contain invert', still ? 'p-0.5' : 'p-1.5')} />
      {!still && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src(1)} alt="" className="exercise-frame absolute inset-0 h-full w-full object-contain p-1.5 invert motion-reduce:hidden" />
      )}
    </div>
  );
}
