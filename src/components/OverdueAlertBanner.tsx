'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, ArrowRight, Zap, Check } from 'lucide-react';

export function OverdueAlertBanner() {
  const [recommendation, setRecommendation] = useState<{
    body_part: string;
    days_since_last_trained: number;
  } | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>('default');

  useEffect(() => {
    async function checkOverdue() {
      try {
        const res = await fetch('/api/splits?userId=1');
        const json = await res.json();
        if (json.success && json.data.recommendation) {
          setRecommendation(json.data.recommendation);
        }
      } catch (err) {
        console.error(err);
      }
    }
    checkOverdue();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted' && recommendation) {
        new Notification('PhysiQ Overdue Alert', {
          body: `Time to hit the gym! Your ${recommendation.body_part} workout has been neglected for ${recommendation.days_since_last_trained} days.`,
          icon: '/favicon.ico',
        });
      }
    }
  };

  // Only show if a muscle group is overdue by 4 or more days
  if (!recommendation || recommendation.days_since_last_trained < 4) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg shadow-amber-500/5 relative overflow-hidden animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono tracking-widest bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold">
                Overdue Alert
              </span>
              <span className="text-xs font-mono text-slate-400">
                Triggered by <code className="text-amber-300">sp_get_next_body_part</code>
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-white mt-1">
              Your <span className="text-amber-400 underline decoration-amber-500/50">{recommendation.body_part}</span> workout has been neglected for <span className="text-white font-extrabold">{recommendation.days_since_last_trained} days</span>!
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Recovery window has cleared. Training this target today preserves muscle balance and progressive overload.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:self-center shrink-0">
          {notifPermission !== 'granted' && (
            <button
              type="button"
              onClick={requestNotification}
              className="text-xs font-mono text-slate-400 hover:text-white bg-slate-900 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Enable PWA Alert</span>
            </button>
          )}

          <Link
            href="/workouts"
            className="text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-amber-400/20 transition-all"
          >
            <span>Log {recommendation.body_part} Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
