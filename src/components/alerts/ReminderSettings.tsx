'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/format';
import { disableNotifications, enableNotifications, isNotifyEnabled, notifySupport, type NotifySupport } from '@/lib/notifications';

/** Per-device switch for the once-a-day "you're overdue" browser notification. */
export function ReminderSettings() {
  const toast = useToast();
  const [support, setSupport] = useState<NotifySupport>('default');
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSupport(notifySupport());
    setOn(isNotifyEnabled());
    setReady(true);
  }, []);

  async function toggle() {
    if (on) {
      disableNotifications();
      setOn(false);
      return;
    }
    const result = await enableNotifications();
    setSupport(result);
    setOn(result === 'granted');
    if (result === 'granted') toast('Reminders on. You’ll get one nudge a day when a workout is overdue.');
    else if (result === 'denied') toast('Notifications are blocked in this browser’s settings.', 'error');
  }

  const unavailable = support === 'unsupported';
  const blocked = support === 'denied';

  return (
    <Card className="flex items-center gap-3">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', on ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-fg-3')}>
        {on ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-headline">Overdue reminders</p>
        <p className="text-footnote text-fg-3">
          {unavailable
            ? 'This browser does not support notifications. On iPhone, add PhysiQ to the Home Screen first.'
            : blocked
              ? 'Blocked. Allow notifications for this site in your browser settings.'
              : 'One notification a day when a split day is overdue. Shown when you open the app.'}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label="Overdue reminders"
        disabled={!ready || unavailable || blocked}
        onClick={toggle}
        className={cn('press relative h-8 w-[3.25rem] shrink-0 rounded-full transition-colors disabled:opacity-40', on ? 'bg-accent' : 'bg-surface-4')}
      >
        <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[1.5rem]' : 'left-1')} />
      </button>
    </Card>
  );
}
