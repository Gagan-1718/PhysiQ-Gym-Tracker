import React from 'react';
import { TrendingUp, Target, Zap, ArrowUpRight } from 'lucide-react';

interface ProgressionTargetProps {
  exerciseName: string;
  muscleGroup: string;
  suggestedWeight: number;
  suggestedReps: number;
  lastWeight?: number;
  lastReps?: number;
}

export function ProgressionTargetWidget({
  exerciseName,
  muscleGroup,
  suggestedWeight,
  suggestedReps,
  lastWeight,
  lastReps,
}: ProgressionTargetProps) {
  const isWeightIncrease = lastWeight && suggestedWeight > lastWeight;
  const isRepIncrease = lastReps && suggestedReps > lastReps;

  return (
    <div className="bg-gradient-to-br from-indigo-950/50 via-slate-900 to-purple-950/40 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-indigo-500/5">
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          Progressive Overload Target
        </div>
        <span className="text-xs font-mono text-slate-400">{muscleGroup}</span>
      </div>

      <div className="space-y-1 mb-4">
        <h3 className="text-xl font-bold text-white tracking-tight">{exerciseName}</h3>
        <p className="text-xs text-slate-400">
          Derived from MySQL history using stored procedure <code className="text-indigo-300 font-mono">sp_estimate_next_target</code>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 my-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Target Weight</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{suggestedWeight}</span>
            <span className="text-xs font-medium text-slate-400">kg</span>
            {isWeightIncrease && (
              <span className="ml-2 text-[11px] font-mono text-emerald-400 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> +2.5kg
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Target Rep Range</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-indigo-400 font-mono">{suggestedReps}</span>
            <span className="text-xs font-medium text-slate-400">reps</span>
            {isRepIncrease && (
              <span className="ml-2 text-[11px] font-mono text-indigo-300 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> +1 rep
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
        <Target className="w-4 h-4 text-indigo-400 shrink-0" />
        <span>
          {isWeightIncrease
            ? 'Top set target reached last session (>=10 reps). Incremented load by +2.5kg.'
            : 'Maintain current load and aim for +1 rep to build overload capacity.'}
        </span>
      </div>
    </div>
  );
}
