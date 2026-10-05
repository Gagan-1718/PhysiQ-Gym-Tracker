'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatWidget } from '@/components/StatWidget';
import { Apple, Flame, Plus, ShieldCheck } from 'lucide-react';

export default function NutritionPage() {
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFoodId, setSelectedFoodId] = useState('1');
  const [quantity, setQuantity] = useState('200');
  const [mealType, setMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'>('Lunch');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    try {
      const res = await fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1,
          foodId: Number(selectedFoodId),
          quantity: Number(quantity),
          mealType,
          logDate,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage('✅ Food intake logged. Daily totals recomputed via view_daily_macro_totals!');
      } else {
        setStatusMessage(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMessage(`❌ Network error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Apple className="w-6 h-6 text-emerald-400" />
              <span>Nutrition &amp; Macro Tracker</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Calculates daily calories and macronutrients without data duplication using normalized relational tables &amp; <code className="text-emerald-300 font-mono">view_daily_macro_totals</code>.
            </p>
          </div>
        </div>

        {/* Daily Macros Snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatWidget label="Calories" value="2,250" subtext="Target: 2,400 kcal" icon={Flame} color="amber" />
          <StatWidget label="Protein" value="165g" subtext="Target: 170g" icon={Apple} color="emerald" />
          <StatWidget label="Carbohydrates" value="240g" subtext="Target: 250g" icon={Apple} color="indigo" />
          <StatWidget label="Fats" value="65g" subtext="Target: 70g" icon={Apple} color="purple" />
        </div>

        {statusMessage && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono">
            {statusMessage}
          </div>
        )}

        {/* Food Intake Logger */}
        <Card title="Log Meal Intake" subtitle="Select seeded food item, quantity in grams, and meal category">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Food Item</label>
                <select
                  value={selectedFoodId}
                  onChange={(e) => setSelectedFoodId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="1">Chicken Breast (Raw)</option>
                  <option value="2">Chicken Breast (Cooked)</option>
                  <option value="3">Eggs (Whole, Raw)</option>
                  <option value="5">Whey Protein Powder</option>
                  <option value="11">White Rice (Cooked)</option>
                  <option value="13">Rolled Oats</option>
                  <option value="20">Peanut Butter</option>
                  <option value="24">Broccoli</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Quantity (grams)</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 150"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Meal Category</label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack">Snack</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary">
                <Plus className="w-4 h-4 mr-1.5" />
                Log Food Entry
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
