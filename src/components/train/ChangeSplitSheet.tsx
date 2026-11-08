'use client';

import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { send } from '@/lib/client';
import { cn } from '@/lib/format';
import { SPLIT_TEMPLATES } from '@/lib/split-templates';

/**
 * Pick a split template, then confirm. Used by Train and Profile so both switch
 * splits the same way: one POST /api/splits transaction, after which every view
 * that depends on the active split (Up Next, recovery, overdue alerts) refreshes.
 */
export function ChangeSplitSheet({ open, onClose, currentName }: { open: boolean; onClose: () => void; currentName: string | null }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (open) setTemplateId(null);
  }, [open]);

  async function switchSplit() {
    const t = SPLIT_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setSwitching(true);
    try {
      await send('/api/splits', 'POST', { name: t.name, minRestDays: t.minRestDays, days: t.days });
      toast(`Switched to ${t.name}`);
      onClose();
      void mutate((key) => typeof key === 'string' && (key.startsWith('/api/splits') || key.startsWith('/api/alerts') || key.startsWith('/api/train')));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not switch', 'error');
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change split"
      footer={
        <Button size="lg" block disabled={!templateId} loading={switching} onClick={switchSplit}>
          Switch split
        </Button>
      }
    >
      <p className="mb-4 text-[15px] text-fg-2">
        Your history stays, and so does your recovery: a new day whose muscles you trained recently starts as recovering.
      </p>
      <div className="grid gap-2" role="radiogroup" aria-label="Split templates">
        {SPLIT_TEMPLATES.map((t) => {
          const current = t.name === currentName;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={templateId === t.id}
              disabled={current}
              onClick={() => setTemplateId(t.id)}
              className={cn(
                'press flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-50',
                templateId === t.id ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 hover:bg-surface-3'
              )}
            >
              <span className="min-w-0">
                <span className="block text-headline">{t.name}</span>
                <span className="text-footnote text-fg-3">{current ? 'Current split' : t.days.map((d) => d.label).join(' · ')}</span>
              </span>
              {templateId === t.id && <Check className="h-5 w-5 shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
