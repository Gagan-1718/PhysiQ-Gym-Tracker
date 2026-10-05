import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatWidgetProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple';
}

export function StatWidget({
  label,
  value,
  subtext,
  icon: Icon,
  color = 'indigo',
}: StatWidgetProps) {
  const colorMap = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {subtext && <p className="text-[11px] text-slate-500 mt-0.5">{subtext}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}
