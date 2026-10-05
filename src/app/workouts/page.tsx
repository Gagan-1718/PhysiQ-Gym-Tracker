'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Dumbbell, Plus, Trash2, CheckCircle2, History } from 'lucide-react';

interface WorkoutSet {
  exerciseId: number;
  exerciseName: string;
  weight: number;
  reps: number;
  isWarmup: boolean;
}

export default function WorkoutsPage() {
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [bodyPart, setBodyPart] = useState('Push');
  const [notes, setNotes] = useState('');
  const [sets, setSets] = useState<WorkoutSet[]>([
    { exerciseId: 1, exerciseName: 'Barbell Bench Press', weight: 60, reps: 10, isWarmup: true },
    { exerciseId: 1, exerciseName: 'Barbell Bench Press', weight: 80, reps: 8, isWarmup: false },
    { exerciseId: 1, exerciseName: 'Barbell Bench Press', weight: 82.5, reps: 8, isWarmup: false },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const addSet = () => {
    setSets([
      ...sets,
      { exerciseId: 1, exerciseName: 'Barbell Bench Press', weight: 60, reps: 10, isWarmup: false },
    ]);
  };

  const removeSet = (index: number) => {
    setSets(sets.filter((_, i) => i !== index));
  };

  const updateSet = (index: number, field: keyof WorkoutSet, value: any) => {
    const updated = [...sets];
    updated[index] = { ...updated[index], [field]: value };
    setSets(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1,
          sessionDate,
          bodyPart,
          notes,
          sets,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage('✅ Workout session and sets logged atomically with MySQL transaction!');
      } else {
        setStatusMessage(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMessage(`❌ Network error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Dumbbell className="w-6 h-6 text-indigo-400" />
              <span>Workout Logger</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Atomically logs workout session header, set records, triggers volume update &amp; detects PRs.
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono">
            {statusMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session Header Card */}
          <Card title="Workout Session Details" subtitle="Session metadata and targeted muscle split">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Workout Date</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Body Part / Day</label>
                <select
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Push">Push (Chest/Shoulders/Triceps)</option>
                  <option value="Pull">Pull (Back/Biceps)</option>
                  <option value="Legs">Legs (Quads/Hamstrings/Calves)</option>
                  <option value="Upper">Upper Body</option>
                  <option value="Lower">Lower Body</option>
                  <option value="Full Body">Full Body</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Session Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Felt great on bench, increased load by 2.5kg"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </Card>

          {/* Sets Entry Card */}
          <Card title="Recorded Sets" subtitle="Individual working sets with load, reps, and RPE">
            <div className="space-y-3">
              {sets.map((set, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 sm:gap-4 items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs sm:text-sm"
                >
                  <div className="col-span-1 text-center font-mono text-slate-500 font-bold">
                    #{idx + 1}
                  </div>

                  <div className="col-span-4">
                    <input
                      type="text"
                      value={set.exerciseName}
                      onChange={(e) => updateSet(idx, 'exerciseName', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                      placeholder="Exercise Name"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.5"
                      value={set.weight}
                      onChange={(e) => updateSet(idx, 'weight', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-center"
                      placeholder="kg"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(idx, 'reps', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-center"
                      placeholder="reps"
                    />
                  </div>

                  <div className="col-span-2 flex items-center justify-center gap-1">
                    <label className="flex items-center gap-1 cursor-pointer text-slate-400 hover:text-white">
                      <input
                        type="checkbox"
                        checked={set.isWarmup}
                        onChange={(e) => updateSet(idx, 'isWarmup', e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span className="text-[10px]">Warmup</span>
                    </label>
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeSet(idx)}
                      disabled={sets.length === 1}
                      className="text-slate-500 hover:text-rose-400 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={addSet}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Set
              </Button>

              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Recording Session...' : 'Submit Workout Transaction'}
              </Button>
            </div>
          </Card>
        </form>
      </main>
    </div>
  );
}
