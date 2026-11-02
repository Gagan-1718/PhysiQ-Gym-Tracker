import { Skeleton } from '@/components/ui/Feedback';

/** Shown while a signed-in page streams in, so navigation never flashes blank. */
export default function Loading() {
  return (
    <div className="space-y-4 pt-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-2/3 rounded-xl" />
      <Skeleton className="h-56 rounded-[1.75rem]" />
      <Skeleton className="h-40" />
    </div>
  );
}
