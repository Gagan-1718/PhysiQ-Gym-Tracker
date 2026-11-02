'use client';

/**
 * Overdue-workout reminders using the Notification API through a service worker.
 *
 * Scope (honest limits): a notification fires when the app is opened or comes
 * back to the foreground and something is overdue — at most once per day. True
 * background push (phone locked, app closed) would need a push server and
 * subscription storage, which this project does not run.
 *
 * The preference lives on the device (localStorage) because notification
 * permission itself is per device and per browser.
 */

const PREF_KEY = 'physiq.notify-overdue';
const LAST_KEY = 'physiq.notify-last';

export type NotifySupport = 'unsupported' | 'denied' | 'default' | 'granted';

export function notifySupport(): NotifySupport {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission;
}

export function isNotifyEnabled(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) === '1' && notifySupport() === 'granted';
  } catch {
    return false;
  }
}

function setPref(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    // storage blocked: the toggle just will not persist
  }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
  } catch {
    return null;
  }
}

/** Must be called from a tap: browsers only show the permission prompt after a user gesture. */
export async function enableNotifications(): Promise<NotifySupport> {
  if (notifySupport() === 'unsupported') return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    await registration();
    setPref(true);
  }
  return result;
}

export function disableNotifications() {
  setPref(false);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Show the reminder once per calendar day. Returns true if a notification was shown. */
export async function notifyOverdueOnce(alert: { body_part: string; days_since: number }): Promise<boolean> {
  if (!isNotifyEnabled()) return false;
  try {
    if (window.localStorage.getItem(LAST_KEY) === todayKey()) return false;
  } catch {
    return false;
  }
  const reg = await registration();
  if (!reg) return false;
  await reg.showNotification('PhysiQ: time to train', {
    body: `${alert.body_part} is ${alert.days_since} days overdue. Tap to start your workout.`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'physiq-overdue', // replaces an earlier one instead of stacking
    data: { url: '/train' },
  });
  try {
    window.localStorage.setItem(LAST_KEY, todayKey());
  } catch {
    // ignore
  }
  return true;
}
