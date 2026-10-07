'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/Card';
import { ProgressionTargetWidget } from '@/components/ProgressionTargetWidget';
import { TrendingUp, RefreshCw, History, Flame, ArrowRight } from 'lucide-react';

export default function ProgressionPage() {
  const [selectedExerciseId, setSelectedExerciseId] = useState<number>(1);
  const [progressionData, setProgressionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgression = async (exerciseId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/progression?userId=1&exerciseId=${exerciseId}`);
      const json = await res.json();
      if (json.success) {
        setProgressionData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgression(selectedExerciseId);
  }, [selectedExerciseId]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
              <span>Progressive Overload Target Estimator</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Derived dynamically via MySQL Stored Procedure <code className="text-indigo-300 font-mono">sp_estimate_next_target</code> from historical set records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="1">Barbell Bench Press (Chest)</option>
              <option value="2">Incline Dumbbell Press (Chest)</option>
              <option value="6">Barbell Deadlift (Back)</option>
              <option value="7">Lat Pulldown (Back)</option>
              <option value="11">Overhead Barbell Press (Shoulders)</option>
              <option value="15">Barbell Back Squat (Quads)</option>
              <option value="17">Romanian Deadlift (Hamstrings)</option>
              <option value="21">Barbell Bicep Curl (Biceps)</option>
            </select>
          </div>
        </div>

        {/* Dynamic Overload Estimation Widget */}
        {progressionData && (
          <ProgressionTargetWidget
            exerciseName={progressionData.exercise.name}
            muscleGroup={progressionData.exercise.muscle_group}
            suggestedWeight={progressionData.recommendation.suggestedWeight}
            suggestedReps={progressionData.recommendation.suggestedReps}
            lastWeight={progressionData.history[0]?.weight}
            lastReps={progressionData.history[0]?.reps}
          />
        )}

        {/* Historical Top Sets Table */}
        <Card title="Historical Top Working Sets" subtitle="Recent session performances used to calculate progressive overload">
          {progressionData?.history && progressionData.history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="pb-3 font-medium">Session Date</th>
                    <th className="pb-3 font-medium">Weight</th>
                    <th className="pb-3 font-medium">Reps</th>
                    <th className="pb-3 font-medium">Est. 1-Rep Max</th>
                    <th className="pb-3 font-medium">RPE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {progressionData.history.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      <td className="py-3 text-slate-300">{row.session_date.split('T')[0]}</td>
                      <td className="py-3 text-indigo-400 font-bold">{row.weight} kg</td>
                      <td className="py-3 text-slate-200">{row.reps} reps</td>
                      <td className="py-3 text-emerald-400 font-bold">{row.estimated_1rm} kg</td>
                      <td className="py-3 text-slate-400">{row.rpe ? `@ ${row.rpe}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              No historical working sets recorded for this exercise yet. Baseline progression targets applied.
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
