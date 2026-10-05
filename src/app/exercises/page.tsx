'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/Card';
import { BookOpen, Search, Dumbbell, Filter } from 'lucide-react';

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const muscleGroups = ['All', 'Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Biceps', 'Triceps', 'Core'];

  const fetchExercises = async () => {
    setLoading(true);
    try {
      let url = `/api/exercises?muscleGroup=${selectedMuscle}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setExercises(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, [selectedMuscle, searchQuery]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-400" />
              <span>Master Exercise Directory</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Indexed MySQL exercise library with muscle group categorization &amp; equipment requirements.
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search exercise by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-2 sm:pb-0">
            {muscleGroups.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedMuscle(group)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedMuscle === group
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((ex) => (
            <Card key={ex.id} title={ex.name} badge={ex.muscle_group}>
              <div className="space-y-2 mt-2">
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Equipment:</strong> {ex.equipment_needed}
                </p>
                {ex.instructions && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {ex.instructions}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
