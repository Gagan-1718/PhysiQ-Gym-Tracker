import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { OverdueAlertBanner } from '@/components/OverdueAlertBanner';
import { DailyFuelWidget } from '@/components/DailyFuelWidget';
import { 
  Database, 
  BrainCircuit, 
  ArrowRight, 
  Dumbbell, 
  Camera, 
  Flame,
  CheckCircle2,
  TrendingUp,
  Layers
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-6 pt-6 flex-1">
        {/* Dynamic Overdue Alert Banner (Triggered by sp_get_next_body_part) */}
        <OverdueAlertBanner />

        {/* Hero Banner Section */}
        <section className="relative overflow-hidden pt-6 pb-6 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
            <span>Closed Feedback Loop: Plan → Train → Record → Analyze → Adapt</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Database-Driven <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Adaptive Fitness</span> System
          </h1>

          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Historical relational records dynamically calculate overdue body parts, calculate session volume via triggers, and prescribe progressive overload targets.
          </p>
        </section>

        {/* Daily Fuel Protocol Card */}
        <DailyFuelWidget />

        {/* Core Architectural Pillars */}
        <section className="py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1: Adaptive Decision Engine */}
          <Link href="/split" className="block group">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 hover:border-indigo-500/40 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Adaptive Training Split</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Uses stored procedure <code className="text-indigo-300 text-xs font-mono">sp_get_next_body_part</code> to recommend overdue targets based on real training history.
                </p>
              </div>
              <div className="text-xs font-mono text-indigo-400 flex items-center gap-1">
                View Adaptive Split <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Pillar 2: Progressive Overload Predictor */}
          <Link href="/progression" className="block group">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 hover:border-violet-500/40 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Progressive Overload Target</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Prescribes next-session weight and rep jumps via <code className="text-violet-300 text-xs font-mono">sp_estimate_next_target</code> and calculates 1RM with <code className="text-violet-300 text-xs font-mono">fn_calculate_1rm</code>.
                </p>
              </div>
              <div className="text-xs font-mono text-violet-400 flex items-center gap-1">
                Estimate Overload Target <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Pillar 3: Workout Logger & ACID Transactions */}
          <Link href="/workouts" className="block group">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 hover:border-pink-500/40 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4 group-hover:scale-110 transition-transform">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">ACID Workout Logger</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Multi-table atomic transactions with automated volume calculation triggers and automated PR detection on submission.
                </p>
              </div>
              <div className="text-xs font-mono text-pink-400 flex items-center gap-1">
                Start Logging Workout <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 mt-12">
        PhysiQ &bull; DBMS Level 3 Project &bull; Built with Next.js &amp; MySQL
      </footer>
    </main>
  );
}
