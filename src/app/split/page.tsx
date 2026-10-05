'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Layers, BrainCircuit, Calendar, Plus, RefreshCw, Check } from 'lucide-react';

export default function SplitPage() {
  const [splitName, setSplitName] = useState('Push / Pull / Legs (PPL)');
  const [days, setDays] = useState([
    { bodyPart: 'Push', lastTrained: '2 days ago' },
    { bodyPart: 'Pull', lastTrained: '6 days ago (Overdue)' },
    { bodyPart: 'Legs', lastTrained: '3 days ago' },
  ]);
  const [recommendedBodyPart, setRecommendedBodyPart] = useState<string>('Pull');
  const [daysOverdue, setDaysOverdue] = useState<number>(6);
  const [loading, setLoading] = useState(false);

  const fetchAdaptiveSplit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/splits?userId=1');
      const json = await res.json();
      if (json.success && json.data.recommendation) {
        setRecommendedBodyPart(json.data.recommendation.recommended_body_part);
        setDaysOverdue(json.data.recommendation.days_since_last_trained);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdaptiveSplit();
  }, []);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-indigo-400" />
              <span>Training Split &amp; Adaptive Engine</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manages user training split and executes MySQL Stored Procedure <code className="text-indigo-300 font-mono">sp_get_next_body_part</code>.
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={fetchAdaptiveSplit} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Re-calculate Overdue Target
          </Button>
        </div>

        {/* Adaptive Recommendation Highlight Card */}
        <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-indigo-500/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
                <BrainCircuit className="w-3.5 h-3.5" />
                Adaptive Decision Algorithm
              </div>
              <h2 className="text-xl font-bold text-white">
                Today's Recommended Focus: <span className="text-indigo-400 underline decoration-indigo-500/40">{recommendedBodyPart}</span>
              </h2>
              <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
                Based on your historical MySQL workout sessions, <strong className="text-slate-200">{recommendedBodyPart}</strong> has not been trained in <strong className="text-indigo-400">{daysOverdue} days</strong>, making it the highest priority according to recovery constraints.
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono text-slate-400 block mb-1">Stored Procedure</span>
              <code className="text-xs font-mono text-indigo-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                CALL sp_get_next_body_part(1, ...)
              </code>
            </div>
          </div>
        </div>

        {/* Active Split Days Configuration */}
        <Card title={`Active Split: ${splitName}`} subtitle="Configured body parts and their last recorded training date in MySQL">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {days.map((day, idx) => (
              <div
                key={idx}
                className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider block mb-1">
                    Day #{idx + 1}
                  </span>
                  <h3 className="text-base font-bold text-white">{day.bodyPart}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{day.lastTrained}</span>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Auto-updated by trigger</span>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
