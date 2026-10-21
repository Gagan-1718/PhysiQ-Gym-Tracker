'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Pill';
import { clock, cn, compact } from '@/lib/format';
import { MOODS } from '@/lib/mood';

export interface JournalInput {
  mood: number | null;
  energy: number | null;
  tags: string[];
  caption: string | null;
}

const TAGS = ['pump', 'fasted', 'pre-workout', 'low sleep', 'deload', 'crowded gym', 'new gym', 'injury care'];

interface FinishSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (journal: JournalInput, saveRoutineAs: string | null) => Promise<void>;
  elapsed: number;
  doneSets: number;
  volume: number;
  untickedSets: number;
  defaultRoutineName: string;
  fromRoutine: boolean;
}

export function FinishSheet({ open, onClose, onSave, elapsed, doneSets, volume, untickedSets, defaultRoutineName, fromRoutine }: FinishSheetProps) {
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [saveRoutine, setSaveRoutine] = useState(false);
  const [routineName, setRoutineName] = useState(defaultRoutineName);
  const [saving, setSaving] = useState(false);

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  async function save() {
    setSaving(true);
    try {
      await onSave({ mood, energy: null, tags, caption: caption.trim() || null }, saveRoutine && routineName.trim() ? routineName.trim() : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Finish workout"
      footer={
        <Button size="lg" block onClick={save} loading={saving} disabled={doneSets === 0}>
          Save workout
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Time', clock(elapsed), 'text-fg'],
          ['Sets', String(doneSets), 'text-accent'],
          ['Volume', `${compact(volume)} kg`, 'text-train'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl bg-surface-2 p-3 text-center">
            <p className="text-footnote text-fg-3">{label}</p>
            <p className={cn('tabular mt-0.5 font-round text-xl font-extrabold', color)}>{value}</p>
          </div>
        ))}
      </div>

      {doneSets === 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-train/10 p-3 text-[15px] text-train">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Tick at least one set to save.
        </p>
      )}
      {doneSets > 0 && untickedSets > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-recover/10 p-3 text-[15px] text-recover">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {untickedSets} unticked set{untickedSets === 1 ? '' : 's'} won’t be saved.
        </p>
      )}

      <p className="mb-2 mt-6 text-headline">How did it feel?</p>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Mood">
        {MOODS.map((m) => (
          <button
            key={m.value}
            role="radio"
            aria-checked={mood === m.value}
            onClick={() => setMood(mood === m.value ? null : m.value)}
            className={cn(
              'press flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-medium transition-colors',
              mood === m.value ? 'border-accent bg-accent/10 text-fg' : 'border-transparent bg-surface-2 text-fg-3'
            )}
          >
            <span className="text-2xl" aria-hidden>
              {m.emoji}
            </span>
            {m.label}
          </button>
        ))}
      </div>

      <p className="mb-2 mt-5 text-headline">Tags</p>
      <div className="flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)}>
            {t}
          </Chip>
        ))}
      </div>

      <label className="mt-5 block">
        <span className="mb-2 block text-headline">Journal</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Anything worth remembering?"
          className="w-full resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[16px] placeholder:text-fg-3 focus:border-accent/60 focus:outline-none"
        />
      </label>
      <p className="mt-1 px-1 text-footnote text-fg-3">Mood, tags and journal go to your MongoDB journey timeline.</p>

      {!fromRoutine && (
        <div className="mt-5 rounded-2xl bg-surface-2 p-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-headline">Save as routine</span>
              <span className="text-footnote text-fg-3">Reuse these exercises next time</span>
            </span>
            <input type="checkbox" checked={saveRoutine} onChange={(e) => setSaveRoutine(e.target.checked)} className="h-6 w-6 accent-[#B6F23B]" />
          </label>
          {saveRoutine && (
            <input
              value={routineName}
              onChange={(e) => setRoutineName(e.target.value)}
              maxLength={60}
              aria-label="Routine name"
              className="mt-3 h-11 w-full rounded-xl border border-line bg-surface-3 px-3 text-[16px] focus:border-accent/60 focus:outline-none"
            />
          )}
        </div>
      )}
    </Sheet>
  );
}
