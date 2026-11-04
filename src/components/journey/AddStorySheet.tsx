'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Pill';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { HttpError, send } from '@/lib/client';
import { cn, localDateISO } from '@/lib/format';
import { prepareImage } from '@/lib/image';
import { MOODS } from '@/lib/mood';

type Mode = 'note' | 'photo';
const ANGLES = ['front', 'side', 'back', 'other'] as const;
const TAGS = ['pump', 'fasted', 'morning', 'post-workout', 'cutting', 'bulking', 'deload'];

/** Add a free-form note or a progress photo to the journey. */
export function AddStorySheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('note');
  const [caption, setCaption] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [angle, setAngle] = useState<(typeof ANGLES)[number]>('front');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function reset() {
    setCaption('');
    setMood(null);
    setTags([]);
    setFile(null);
    setAngle('front');
  }

  async function save() {
    setSaving(true);
    try {
      if (mode === 'note') {
        await send('/api/journey', 'POST', { date: localDateISO(), caption, mood, tags });
      } else {
        if (!file) throw new Error('Choose or take a photo first.');
        const jpeg = await prepareImage(file);
        const form = new FormData();
        form.set('file', jpeg, 'photo.jpg');
        form.set('date', localDateISO());
        form.set('angle', angle);
        if (caption.trim()) form.set('caption', caption.trim());
        if (tags.length) form.set('tags', tags.join(','));
        const res = await fetch('/api/journey/photo', { method: 'POST', body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new HttpError(res.status, body.error ?? 'Upload failed');
      }
      toast(mode === 'note' ? 'Note added' : 'Photo added');
      reset();
      onAdded();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  const canSave = mode === 'note' ? caption.trim().length > 0 : file !== null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add to journey"
      footer={
        <Button size="lg" block loading={saving} disabled={!canSave} onClick={save}>
          {mode === 'note' ? 'Add note' : 'Add photo'}
        </Button>
      }
    >
      <Segmented
        label="Entry type"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'note', label: 'Note' },
          { value: 'photo', label: 'Progress photo' },
        ]}
      />

      {mode === 'photo' && (
        <div className="mt-4">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Choose a photo" />
          {preview ? (
            <button onClick={() => fileInput.current?.click()} className="press block w-full overflow-hidden rounded-2xl bg-surface-2" aria-label="Change photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={preview} alt="Selected photo preview" className="max-h-72 w-full object-cover" />
            </button>
          ) : (
            <button
              onClick={() => fileInput.current?.click()}
              className="press flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface-2 text-fg-2 hover:text-fg"
            >
              <ImagePlus className="h-7 w-7" />
              <span className="text-[15px] font-medium">Take or choose a photo</span>
              <span className="text-footnote text-fg-3">Resized on your device; location data is removed</span>
            </button>
          )}
          <p className="mb-2 mt-4 text-headline">Angle</p>
          <div className="flex gap-2">
            {ANGLES.map((a) => (
              <Chip key={a} active={angle === a} onClick={() => setAngle(a)} className="capitalize">
                {a}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <label className="mt-5 block">
        <span className="mb-2 block text-headline">{mode === 'note' ? 'What’s on your mind?' : 'Caption (optional)'}</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[16px] placeholder:text-fg-3 focus:border-accent/60 focus:outline-none"
          placeholder={mode === 'note' ? 'Progress, plateaus, how training feels' : 'Lighting, pump, conditions'}
        />
      </label>

      {mode === 'note' && (
        <>
          <p className="mb-2 mt-5 text-headline">Mood</p>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Mood">
            {MOODS.map((m) => (
              <button
                key={m.value}
                role="radio"
                aria-checked={mood === m.value}
                onClick={() => setMood(mood === m.value ? null : m.value)}
                className={cn('press flex flex-col items-center gap-1 rounded-2xl border py-2 text-xs font-medium', mood === m.value ? 'border-accent bg-accent/10 text-fg' : 'border-transparent bg-surface-2 text-fg-3')}
              >
                <span className="text-xl" aria-hidden>
                  {m.emoji}
                </span>
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mb-2 mt-5 text-headline">Tags</p>
      <div className="flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <Chip key={t} active={tags.includes(t)} onClick={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}>
            {t}
          </Chip>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-footnote text-fg-3">
        <Camera className="h-3.5 w-3.5" /> Photos are private: only you can open them.
      </p>
    </Sheet>
  );
}
