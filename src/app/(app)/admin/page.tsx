'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { ChevronLeft, Plus, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Chip } from '@/components/ui/Pill';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { send } from '@/lib/client';
import { cn } from '@/lib/format';
import { useLibrary } from '@/lib/training';
import { EQUIPMENT, type Equipment, type Exercise } from '@/types/database';

interface AuditRow {
  id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  target_id: number;
  details: { name?: string; before?: { name: string }; after?: { name: string } } | null;
  created_at: string;
  admin_name: string | null;
}

const ACTION_STYLE: Record<AuditRow['action'], string> = {
  INSERT: 'bg-accent/15 text-accent',
  UPDATE: 'bg-water/15 text-water',
  DELETE: 'bg-train/15 text-train',
};

type Form = { id: number | null; name: string; muscleGroupId: number | null; equipment: Equipment; instructions: string };
const EMPTY: Form = { id: null, name: '', muscleGroupId: null, equipment: 'Barbell', instructions: '' };

export default function AdminPage() {
  const toast = useToast();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const library = useLibrary();
  const audit = useSWR<AuditRow[]>(isAdmin ? '/api/admin/audit' : null);
  const [tab, setTab] = useState<'library' | 'audit'>('library');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library.data?.exercises ?? []).filter((e) => !q || e.name.toLowerCase().includes(q) || e.muscle_group.toLowerCase().includes(q));
  }, [library.data, query]);

  if (session && !isAdmin) {
    return <EmptyState className="mt-10" icon={<Search className="h-5 w-5" />} title="Admins only" body="This area manages the shared exercise library." />;
  }

  async function submit() {
    if (!form || !form.muscleGroupId) return;
    setBusy(true);
    const body = { name: form.name, muscleGroupId: form.muscleGroupId, equipment: form.equipment, instructions: form.instructions || null };
    try {
      if (form.id) await send(`/api/exercises/${form.id}`, 'PATCH', body);
      else await send('/api/exercises', 'POST', body);
      toast(form.id ? 'Exercise updated' : 'Exercise added');
      setForm(null);
      await Promise.all([library.mutate(), audit.mutate()]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!form?.id) return;
    setBusy(true);
    try {
      await send(`/api/exercises/${form.id}`, 'DELETE');
      toast('Exercise deleted');
      setForm(null);
      await Promise.all([library.mutate(), audit.mutate()]);
    } catch (err) {
      // FK RESTRICT: someone has logged sets with it
      toast(err instanceof Error && /in use/.test(err.message) ? 'Already used in workouts, so it cannot be deleted.' : 'Could not delete', 'error');
    } finally {
      setBusy(false);
    }
  }

  const edit = (e: Exercise) =>
    setForm({ id: e.id, name: e.name, muscleGroupId: e.muscle_group_id, equipment: e.equipment_needed, instructions: e.instructions ?? '' });

  return (
    <>
      <header className="pb-4 pt-4">
        <Link href="/profile" className="press -ml-2 inline-flex h-9 items-center gap-1 rounded-full px-2 text-[17px] text-accent">
          <ChevronLeft className="h-5 w-5" /> Profile
        </Link>
        <h1 className="mt-1 text-large-title">Admin</h1>
      </header>
      <Segmented
        label="Admin view"
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { value: 'library', label: 'Exercise library' },
          { value: 'audit', label: 'Audit log' },
        ]}
      />

      {tab === 'library' && (
        <>
          <div className="mb-4 flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search exercises</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${library.data?.exercises.length ?? ''} exercises`}
                className="h-11 w-full rounded-xl border border-line bg-surface-1 pl-10 pr-4 text-[16px] placeholder:text-fg-3 focus:border-accent/60 focus:outline-none"
              />
            </label>
            <Button onClick={() => setForm({ ...EMPTY, muscleGroupId: library.data?.muscleGroups[0]?.id ?? null })}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          {!library.data ? (
            <Skeleton className="h-96" />
          ) : (
            <ul className="overflow-hidden rounded-card border border-line bg-surface-1">
              {list.map((e) => (
                <li key={e.id} className="border-b border-line last:border-0">
                  <button onClick={() => edit(e)} className="press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">{e.name}</span>
                      <span className="text-footnote text-fg-3">
                        {e.muscle_group} · {e.equipment_needed}
                      </span>
                    </span>
                    <span className="text-footnote text-fg-3">#{e.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'audit' && (
        <>
          <p className="mb-3 text-[15px] text-fg-2">Written by the trg_exercises_* triggers. The app sets @app_user_id so the database knows who acted.</p>
          {!audit.data ? (
            <Skeleton className="h-96" />
          ) : (
            <ul className="space-y-2">
              {audit.data.map((a) => (
                <li key={a.id}>
                  <Card className="flex items-start gap-3 p-3.5 sm:p-4">
                    <span className={cn('mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold', ACTION_STYLE[a.action])}>{a.action}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">
                        {a.action === 'UPDATE' ? `${a.details?.before?.name} → ${a.details?.after?.name}` : (a.details?.name ?? `exercise #${a.target_id}`)}
                      </p>
                      <p className="text-footnote text-fg-3">
                        {a.admin_name ?? 'System / seed'} · {a.created_at.slice(0, 16)}
                      </p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit exercise' : 'New exercise'}
        footer={
          <div className="grid gap-2">
            <Button size="lg" block loading={busy} disabled={!form?.name.trim() || !form?.muscleGroupId} onClick={submit}>
              {form?.id ? 'Save' : 'Add to library'}
            </Button>
            {form?.id && (
              <Button variant="ghost" block className="text-train hover:text-train" disabled={busy} onClick={remove}>
                Delete exercise
              </Button>
            )}
          </div>
        }
      >
        {form && (
          <div className="space-y-5">
            <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} />
            <div>
              <p className="mb-2 px-1 text-footnote font-medium text-fg-2">Muscle group</p>
              <div className="flex flex-wrap gap-2">
                {library.data?.muscleGroups.map((m) => (
                  <Chip key={m.id} active={form.muscleGroupId === m.id} onClick={() => setForm({ ...form, muscleGroupId: m.id })}>
                    {m.name}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 px-1 text-footnote font-medium text-fg-2">Equipment</p>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.map((eq) => (
                  <Chip key={eq} active={form.equipment === eq} onClick={() => setForm({ ...form, equipment: eq })}>
                    {eq}
                  </Chip>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block px-1 text-footnote font-medium text-fg-2">How to</span>
              <textarea
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[16px] focus:border-accent/60 focus:outline-none"
              />
            </label>
          </div>
        )}
      </Sheet>
    </>
  );
}
