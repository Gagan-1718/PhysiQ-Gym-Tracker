'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { ChevronLeft, Pencil, Trash2, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorNote, Skeleton } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import { EditableSets, type SetDraft } from '@/components/history/EditableSets';
import { useToast } from '@/components/ui/Toast';
import { send } from '@/lib/client';
import { cn, compact, kg, minutesBetween, shortDate } from '@/lib/format';
import type { SessionSet, SessionSummary } from '@/types/database';

interface Detail {
  session: Omit<SessionSummary, 'exercise_count' | 'working_sets' | 'pr_count'>;
  sets: SessionSet[];
  journal: { mood: number | null; energy: number | null; tags: string[]; caption: string | null } | null;
}

const MOOD = ['', '😫 Drained', '😕 Meh', '🙂 Solid', '😀 Strong', '🔥 On fire'];

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { data, error } = useSWR<Detail>(`/api/workouts/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, SetDraft>>({});
  const [saving, setSaving] = useState(false);

  function startEdit() {
    if (!data) return;
    setDrafts(Object.fromEntries(data.sets.map((s) => [s.id, { weight: s.weight, reps: s.reps, warmup: s.is_warmup, deleted: false }])));
    setEditing(true);
  }
  const patchDraft = (setId: number, patch: Partial<SetDraft>) => setDrafts((d) => ({ ...d, [setId]: { ...d[setId], ...patch } }));

  // What actually changed versus the saved workout
  const changes = useMemo(() => {
    const updates: { id: number; weight: number; reps: number; warmup: boolean }[] = [];
    const deleteSetIds: number[] = [];
    for (const s of data?.sets ?? []) {
      const d = drafts[s.id];
      if (!d) continue;
      if (d.deleted) deleteSetIds.push(s.id);
      else if (d.weight !== null && d.reps !== null && (d.weight !== s.weight || d.reps !== s.reps || d.warmup !== s.is_warmup)) {
        updates.push({ id: s.id, weight: d.weight, reps: d.reps, warmup: d.warmup });
      }
    }
    const remaining = (data?.sets.length ?? 0) - deleteSetIds.length;
    const incomplete = (data?.sets ?? []).some((s) => drafts[s.id] && !drafts[s.id].deleted && (drafts[s.id].weight === null || !drafts[s.id].reps));
    return { updates, deleteSetIds, remaining, incomplete };
  }, [data, drafts]);

  async function saveEdit() {
    if (changes.updates.length === 0 && changes.deleteSetIds.length === 0) return setEditing(false);
    setSaving(true);
    try {
      await send(`/api/workouts/${id}`, 'PATCH', { sets: changes.updates, deleteSetIds: changes.deleteSetIds });
      toast('Workout updated');
      setEditing(false);
      await mutate(`/api/workouts/${id}`);
      void mutate((key) => typeof key === 'string' && (key.startsWith('/api/workouts') || key.startsWith('/api/splits') || key.startsWith('/api/progress') || key.startsWith('/api/train')));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save the changes', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await send(`/api/workouts/${id}`, 'DELETE');
      toast('Workout deleted');
      // Drop this workout's cache entry without refetching it (it no longer exists), refresh the lists
      const own = `/api/workouts/${id}`;
      await mutate(own, undefined, { revalidate: false });
      void mutate((key) => typeof key === 'string' && key !== own && (key.startsWith('/api/workouts') || key.startsWith('/api/splits') || key.startsWith('/api/progress')));
      router.replace('/history');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete', 'error');
      setDeleting(false);
    }
  }

  const byExercise = new Map<number, SessionSet[]>();
  for (const s of data?.sets ?? []) byExercise.set(s.exercise_id, [...(byExercise.get(s.exercise_id) ?? []), s]);
  const minutes = data ? minutesBetween(data.session.started_at, data.session.ended_at) : null;
  const working = data?.sets.filter((s) => !s.is_warmup).length ?? 0;

  return (
    <>
      <header className="pb-3 pt-4">
        <Link href="/history" className="press -ml-2 inline-flex h-9 items-center gap-1 rounded-full px-2 text-[17px] text-accent">
          <ChevronLeft className="h-5 w-5" /> History
        </Link>
      </header>

      {error && <ErrorNote message={error.message} />}
      {!data && !error && <Skeleton className="h-96" />}
      {data && (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-eyebrow uppercase text-fg-3">{shortDate(data.session.session_date)}</p>
              <h1 className="mt-1 text-large-title">{data.session.body_part}</h1>
            </div>
            {!editing && (
              <Button variant="secondary" size="sm" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              ['Volume', compact(data.session.total_volume), 'kg', 'text-train'],
              ['Sets', String(working), '', 'text-accent'],
              ['Time', minutes ? String(minutes) : '–', minutes ? 'min' : '', 'text-water'],
            ].map(([label, value, unit, color]) => (
              <div key={label} className="rounded-2xl bg-surface-1 p-3.5">
                <p className="text-footnote text-fg-3">{label}</p>
                <p className={cn('tabular mt-0.5 font-round text-2xl font-extrabold', color)}>
                  {value}
                  {unit && <span className="text-sm text-fg-2"> {unit}</span>}
                </p>
              </div>
            ))}
          </div>

          {data.journal && (
            <Card className="mt-4">
              <p className="text-eyebrow uppercase text-fg-3">Journal</p>
              {data.journal.mood && <p className="mt-2 text-headline">{MOOD[data.journal.mood]}</p>}
              {data.journal.caption && <p className="mt-1 text-[15px] text-fg-2">{data.journal.caption}</p>}
              {data.journal.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.journal.tags.map((t) => (
                    <span key={t} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-fg-2">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}
          {data.session.notes && <p className="mt-4 rounded-2xl bg-surface-1 p-4 text-[15px] text-fg-2">{data.session.notes}</p>}

          <div className="mt-4 space-y-3">
            {[...byExercise.values()].map((sets) => {
              let n = 0;
              return (
                <Card key={sets[0].exercise_id}>
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-headline">{sets[0].exercise_name}</h2>
                    <span className="text-footnote text-fg-3">{sets[0].muscle_group}</span>
                  </div>
                  {editing ? (
                    <EditableSets sets={sets} drafts={drafts} onChange={patchDraft} />
                  ) : (
                  <ul className="mt-3 space-y-1.5">
                    {sets.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 text-[15px]">
                        <span className={cn('w-6 text-center font-round font-extrabold', s.is_warmup ? 'text-recover' : 'text-fg-3')}>{s.is_warmup ? 'W' : ++n}</span>
                        <span className="tabular flex-1 font-medium">
                          {kg(s.weight)} kg × {s.reps}
                          {s.rpe ? <span className="text-fg-3"> · RPE {s.rpe}</span> : null}
                        </span>
                        {s.is_pr && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                            <Trophy className="h-3 w-3" /> PR
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  )}
                </Card>
              );
            })}
          </div>

          {!editing && (
            <Button variant="danger" block className="mt-8" onClick={() => setConfirm(true)}>
              <Trash2 className="h-4 w-4" /> Delete workout
            </Button>
          )}
          {editing && <div className="h-24" aria-hidden />}
        </>
      )}

      {editing && (
        <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] z-40 border-t border-line bg-black/85 px-4 py-3 backdrop-blur-2xl md:bottom-0 md:left-64">
          <div className="mx-auto max-w-3xl">
            {changes.remaining <= 0 && <p className="mb-2 text-footnote text-train">A workout needs at least one set. Restore one, or delete the whole workout instead.</p>}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="lg" loading={saving} disabled={changes.remaining <= 0 || changes.incomplete} onClick={saveEdit}>
                Save{changes.updates.length + changes.deleteSetIds.length > 0 ? ` (${changes.updates.length + changes.deleteSetIds.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete this workout?">
        <p className="text-[15px] text-fg-2">
          Its sets are removed and the database recalculates your recovery status and personal records automatically.
        </p>
        <div className="mt-6 grid gap-3">
          <Button variant="danger" size="lg" loading={deleting} onClick={remove}>
            Delete
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </>
  );
}
