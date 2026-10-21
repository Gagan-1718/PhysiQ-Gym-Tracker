'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { signOut, useSession } from 'next-auth/react';
import { Check, ChevronRight, Download, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import { Stepper } from '@/components/ui/Stepper';
import { ReminderSettings } from '@/components/alerts/ReminderSettings';
import { useToast } from '@/components/ui/Toast';
import { send } from '@/lib/client';
import { cn } from '@/lib/format';
import { SPLIT_TEMPLATES } from '@/lib/split-templates';
import { GOALS, type Goal, type SplitDayStatus, type User } from '@/types/database';

export default function ProfilePage() {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { data: session } = useSession();
  const me = useSWR<User & { needsOnboarding: boolean }>('/api/me');
  const split = useSWR<{ splitName: string | null; days: SplitDayStatus[] }>('/api/splits');

  const [goal, setGoal] = useState<Goal>('hypertrophy');
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(4);
  const [height, setHeight] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!me.data) return;
    setGoal(me.data.goal);
    setWeeklyGoal(me.data.weekly_goal);
    setHeight(me.data.height);
  }, [me.data]);

  const dirty = me.data && (goal !== me.data.goal || weeklyGoal !== me.data.weekly_goal || height !== me.data.height);

  async function saveProfile() {
    setSaving(true);
    try {
      await send('/api/me', 'PATCH', { goal, weekly_goal: weeklyGoal ?? 4, height });
      toast('Profile updated');
      await me.mutate();
      void mutate((key) => typeof key === 'string' && (key.startsWith('/api/fuel') || key.startsWith('/api/progress')));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function switchSplit() {
    const t = SPLIT_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setSwitching(true);
    try {
      await send('/api/splits', 'POST', { name: t.name, minRestDays: t.minRestDays, days: t.days });
      toast(`Switched to ${t.name}`);
      setSplitOpen(false);
      void mutate((key) => typeof key === 'string' && key.startsWith('/api/splits'));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not switch', 'error');
    } finally {
      setSwitching(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await send('/api/me', 'DELETE', { password });
      await signOut({ callbackUrl: '/register' });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete', 'error');
      setDeleting(false);
    }
  }

  return (
    <>
      <header className="pb-5 pt-4">
        <h1 className="text-large-title">Profile</h1>
      </header>

      <Card className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-train to-train-deep text-xl font-bold">
          {session?.user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-headline">{session?.user?.name}</p>
          <p className="truncate text-[15px] text-fg-2">{session?.user?.email}</p>
        </div>
        {session?.user?.role === 'admin' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-water/15 px-2.5 py-1 text-xs font-bold text-water">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin
          </span>
        )}
      </Card>

      <SectionHeader title="Training split" />
      {!split.data ? (
        <Skeleton className="h-28" />
      ) : (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-headline">{split.data.splitName ?? 'No split'}</p>
              <p className="text-footnote text-fg-3">Rest {split.data.days[0]?.min_rest_days ?? 2} days between the same day</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setSplitOpen(true)}>
              Change
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {split.data.days.map((d) => (
              <span key={d.split_day_id} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-fg-2">
                {d.body_part}
              </span>
            ))}
          </div>
        </Card>
      )}

      <SectionHeader title="Goal & targets" />
      {!me.data ? (
        <Skeleton className="h-80" />
      ) : (
        <Card>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Goal">
            {GOALS.map((g) => (
              <button
                key={g.value}
                role="radio"
                aria-checked={goal === g.value}
                onClick={() => setGoal(g.value)}
                className={cn(
                  'press rounded-2xl border p-3 text-left transition-colors',
                  goal === g.value ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 hover:bg-surface-3'
                )}
              >
                <span className="block text-[15px] font-semibold">{g.label}</span>
                <span className="text-footnote text-fg-3">{g.blurb}</span>
              </button>
            ))}
          </div>
          <p className="mb-2 mt-5 text-footnote font-medium text-fg-2">Sessions per week (Train ring)</p>
          <Stepper label="sessions per week" value={weeklyGoal} onChange={setWeeklyGoal} step={1} min={1} max={7} size="md" />
          <p className="mb-2 mt-4 text-footnote font-medium text-fg-2">Height</p>
          <Stepper label="height" value={height} onChange={setHeight} step={1} min={100} max={250} unit="cm" size="md" />
          <p className="mt-3 text-footnote text-fg-3">
            Log body weight in{' '}
            <Link href="/progress" className="text-accent underline underline-offset-2">
              Progress → Body
            </Link>
            ; protein and water targets follow it.
          </p>
          <Button block size="lg" className="mt-5" disabled={!dirty} loading={saving} onClick={saveProfile}>
            Save changes
          </Button>
        </Card>
      )}

      <SectionHeader title="Reminders" />
      <ReminderSettings />

      {session?.user?.role === 'admin' && (
        <>
          <SectionHeader title="Admin" />
          <Link href="/admin" className="press flex items-center gap-3 rounded-card border border-line bg-surface-1 p-4 hover:bg-surface-2">
            <ShieldCheck className="h-5 w-5 text-water" />
            <span className="flex-1">
              <span className="block text-headline">Exercise library & audit log</span>
              <span className="text-footnote text-fg-3">Every change is recorded by a database trigger</span>
            </span>
            <ChevronRight className="h-5 w-5 text-fg-3" />
          </Link>
        </>
      )}

      <SectionHeader title="Your data" />
      <a
        href="/api/me/export"
        download
        className="press flex items-center gap-3 rounded-card border border-line bg-surface-1 p-4 hover:bg-surface-2"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-water/15 text-water">
          <Download className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-headline">Download my data</span>
          <span className="text-footnote text-fg-3">Workouts, records, measurements, journal and routines as one JSON file</span>
        </span>
        <ChevronRight className="h-5 w-5 text-fg-3" />
      </a>

      <div className="mt-8 grid gap-3">
        <Button variant="secondary" size="lg" block onClick={() => signOut({ callbackUrl: '/login' })}>
          <LogOut className="h-5 w-5" /> Sign out
        </Button>
        <Button variant="ghost" block className="text-train hover:text-train" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete account
        </Button>
      </div>

      <Sheet
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        title="Change split"
        footer={
          <Button size="lg" block disabled={!templateId} loading={switching} onClick={switchSplit}>
            Switch split
          </Button>
        }
      >
        <p className="mb-4 text-[15px] text-fg-2">Your history stays. The new split starts fresh, so each day shows as “not started”.</p>
        <div className="grid gap-2" role="radiogroup">
          {SPLIT_TEMPLATES.map((t) => {
            const current = t.name === split.data?.splitName;
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={templateId === t.id}
                disabled={current}
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  'press flex items-center justify-between rounded-2xl border p-4 text-left transition-colors disabled:opacity-50',
                  templateId === t.id ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 hover:bg-surface-3'
                )}
              >
                <span>
                  <span className="block text-headline">{t.name}</span>
                  <span className="text-footnote text-fg-3">{current ? 'Current split' : t.days.map((d) => d.label).join(' · ')}</span>
                </span>
                {templateId === t.id && <Check className="h-5 w-5 text-accent" />}
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account">
        <p className="text-[15px] text-fg-2">
          This permanently deletes your workouts, records, measurements, routines and journal from both databases.
        </p>
        <Field label="Confirm with your password" type="password" autoComplete="current-password" className="mt-5" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button variant="danger" size="lg" block className="mt-5" disabled={!password} loading={deleting} onClick={deleteAccount}>
          Delete everything
        </Button>
      </Sheet>
    </>
  );
}
