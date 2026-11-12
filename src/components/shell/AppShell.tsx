'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/format';
import { LogoMark, Wordmark } from './Logo';
import { NAV_ITEMS, isActive } from './nav';
import { ActiveWorkoutBar } from './ActiveWorkoutBar';
import { OverdueBanner } from '@/components/alerts/OverdueBanner';
import { OfflineBadge } from './OfflineBadge';
import { AppTour } from '@/components/tour/AppTour';
import { send } from '@/lib/client';
import { useWorkoutDraft } from '@/lib/workout-draft';

/**
 * Phone: content + translucent bottom tab bar (thumb reach).
 * Laptop: fixed sidebar + centred content column.
 * `tour`: the member has not seen the app tour yet; it starts on Today (also on /?tour=1, from Profile).
 */
export function AppShell({ children, tour = false }: { children: React.ReactNode; tour?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const hideChrome = pathname.startsWith('/train/session');
  const [draft] = useWorkoutDraft(session?.user?.id);

  const tourPending = useRef(tour);
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (pathname !== '/') return;
    const replay = new URLSearchParams(window.location.search).get('tour') === '1';
    if (tourPending.current || replay) setTourOpen(true);
  }, [pathname]);
  const endTour = useCallback(() => {
    tourPending.current = false;
    setTourOpen(false);
    if (new URLSearchParams(window.location.search).has('tour')) router.replace('/');
    // Remembered in MySQL (users.tour_completed_at), so it shows once per account, not per device
    send('/api/me', 'PATCH', { tour_completed: true }).catch(() => {});
  }, [router]);

  return (
    <div className="min-h-dvh md:pl-64">
      {/* Sidebar (md+) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-canvas px-4 py-6 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <LogoMark size={38} />
          <Wordmark />
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                data-tour={`nav-${item.label.toLowerCase()}`}
                className={cn(
                  'relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
                  active ? 'text-fg' : 'text-fg-3 hover:bg-surface-1 hover:text-fg-2'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-surface-2"
                    transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                  />
                )}
                <Icon className={cn('relative h-5 w-5', active && 'text-accent')} />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {session?.user && (
          <div className="mt-auto rounded-2xl bg-surface-1 p-3">
            <p className="truncate text-[15px] font-semibold">{session.user.name}</p>
            <p className="truncate text-footnote text-fg-3">{session.user.email}</p>
          </div>
        )}
      </aside>

      <main className={cn('mx-auto w-full max-w-3xl px-4 pt-safe sm:px-6', hideChrome ? 'pb-safe' : draft ? 'pb-[calc(var(--tabbar-h)+var(--safe-bottom)+6rem)] md:pb-28' : 'pb-tabbar md:pb-12')}>
        <div className="pt-3 empty:hidden">
          <OfflineBadge />
          {!hideChrome && <OverdueBanner />}
        </div>
        {children}
      </main>

      {!hideChrome && <ActiveWorkoutBar />}

      {/* Tab bar (phones) */}
      {!hideChrome && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/80 backdrop-blur-2xl md:hidden"
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          <div className="mx-auto flex h-[var(--tabbar-h)] max-w-md items-stretch justify-around px-2">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  data-tour={`nav-${item.label.toLowerCase()}`}
                  className={cn(
                    'press flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                    active ? 'text-accent' : 'text-fg-3'
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {tourOpen && pathname === '/' && <AppTour name={session?.user?.name?.split(' ')[0] ?? null} onDone={endTour} />}
    </div>
  );
}
