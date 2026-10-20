'use client';

import { useState, useEffect } from 'react';
import { Flame, Droplets, Moon, CheckCircle2, Circle, Sparkles, RefreshCw } from 'lucide-react';

interface FuelData {
  proteinTargetG: number;
  waterTargetL: number;
  calorieTarget: number;
  proteinCompleted: boolean;
  waterCompleted: boolean;
  sleepHours: number;
}

export function DailyFuelWidget() {
  const [fuel, setFuel] = useState<FuelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchFuel = async () => {
    try {
      const res = await fetch('/api/fuel?userId=1');
      const json = await res.json();
      if (json.success && json.data) {
        setFuel(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFuel();
  }, []);

  const toggleStatus = async (field: 'proteinCompleted' | 'waterCompleted') => {
    if (!fuel) return;
    const nextVal = !fuel[field];
    setFuel({ ...fuel, [field]: nextVal });

    setUpdating(true);
    try {
      await fetch('/api/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1,
          [field]: nextVal,
        }),
      });
    } catch (err) {
      console.error(err);
      fetchFuel(); // rollback on error
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 animate-pulse text-xs text-slate-500">
        Loading daily fuel protocol from MySQL...
      </div>
    );
  }

  const completedCount = (fuel?.proteinCompleted ? 1 : 0) + (fuel?.waterCompleted ? 1 : 0);

  return (
    <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-indigo-950/30 border border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Daily Fuel &amp; Recovery Protocol</h3>
            <p className="text-xs text-slate-400">Calculated dynamically via stored function <code className="text-indigo-300 font-mono">fn_calculate_daily_protein</code></p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          {completedCount}/2 Targets Hit
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        {/* Protein Target Pill */}
        <button
          type="button"
          onClick={() => toggleStatus('proteinCompleted')}
          className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between group ${
            fuel?.proteinCompleted
              ? 'bg-emerald-950/30 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Daily Protein Target
            </span>
            {fuel?.proteinCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Circle className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-white">{fuel?.proteinTargetG || 150}</span>
            <span className="text-xs text-slate-400">g</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {fuel?.proteinCompleted ? '✓ Target achieved today' : 'Tap to mark as achieved'}
          </p>
        </button>

        {/* Hydration Target Pill */}
        <button
          type="button"
          onClick={() => toggleStatus('waterCompleted')}
          className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between group ${
            fuel?.waterCompleted
              ? 'bg-cyan-950/30 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              Hydration Goal
            </span>
            {fuel?.waterCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <Circle className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-white">{fuel?.waterTargetL || 3.0}</span>
            <span className="text-xs text-slate-400">Liters</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {fuel?.waterCompleted ? '✓ Hydration target hit' : 'Tap to mark as achieved'}
          </p>
        </button>

        {/* Caloric & Sleep Baseline */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mb-2">
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              Recovery &amp; Calories
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-indigo-400">{fuel?.calorieTarget || 2600}</span>
              <span className="text-xs text-slate-400">kcal target</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>Optimal rest: 7–8 hrs</span>
            <span className="font-mono text-slate-400">{fuel?.sleepHours || 7.5}h</span>
          </p>
        </div>
      </div>
    </div>
  );
}
