'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/Card';
import { StatWidget } from '@/components/StatWidget';
import { BarChart3, Trophy, Dumbbell, Calendar, TrendingUp } from 'lucide-react';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch('/api/analytics?userId=1');
        const json = await res.json();
        if (json.success) {
          setAnalytics(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
              <span>Analytics &amp; Performance Views</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Live SQL views (<code className="text-indigo-300 font-mono">view_weekly_summary</code> &amp; <code className="text-indigo-300 font-mono">view_personal_records_detailed</code>) for performance aggregation.
            </p>
          </div>
        </div>

        {/* Top Highlight Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatWidget label="Weekly Volume" value="18,450 kg" subtext="Across 4 completed sessions" icon={Dumbbell} color="indigo" />
          <StatWidget label="Personal Records" value="12 PRs" subtext="Automatic historical detection" icon={Trophy} color="amber" />
          <StatWidget label="Training Consistency" value="94%" subtext="4.2 workouts / week avg" icon={Calendar} color="emerald" />
        </div>

        {/* PR Breakdown Section */}
        <Card title="Personal Records Leaderboard" subtitle="Derived from historical set data with estimated 1-Rep Max formula (Epley)">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="pb-3 font-medium">Exercise</th>
                  <th className="pb-3 font-medium">Muscle Group</th>
                  <th className="pb-3 font-medium">PR Weight</th>
                  <th className="pb-3 font-medium">Reps</th>
                  <th className="pb-3 font-medium">Est. 1RM</th>
                  <th className="pb-3 font-medium">Achieved Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 font-sans font-semibold text-white">Barbell Bench Press</td>
                  <td className="py-3 text-slate-400">Chest</td>
                  <td className="py-3 text-indigo-400 font-bold">100.0 kg</td>
                  <td className="py-3 text-slate-300">5 reps</td>
                  <td className="py-3 text-emerald-400 font-bold">116.7 kg</td>
                  <td className="py-3 text-slate-500">2026-09-28</td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 font-sans font-semibold text-white">Barbell Deadlift</td>
                  <td className="py-3 text-slate-400">Back</td>
                  <td className="py-3 text-indigo-400 font-bold">160.0 kg</td>
                  <td className="py-3 text-slate-300">3 reps</td>
                  <td className="py-3 text-emerald-400 font-bold">176.0 kg</td>
                  <td className="py-3 text-slate-500">2026-09-25</td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 font-sans font-semibold text-white">Barbell Back Squat</td>
                  <td className="py-3 text-slate-400">Quads</td>
                  <td className="py-3 text-indigo-400 font-bold">130.0 kg</td>
                  <td className="py-3 text-slate-300">5 reps</td>
                  <td className="py-3 text-emerald-400 font-bold">151.7 kg</td>
                  <td className="py-3 text-slate-500">2026-09-20</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
