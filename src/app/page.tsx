import Link from 'next/link';
import { 
  Database, 
  BrainCircuit, 
  ArrowRight, 
  Dumbbell, 
  Camera, 
  Flame,
  CheckCircle2
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-500/20">
              Φ
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-white">Physi<span className="text-indigo-400">Q</span></span>
              <span className="text-[10px] uppercase font-mono tracking-widest bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full ml-2 border border-indigo-500/20">Pure MySQL DBMS</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/api/health" 
              className="text-xs font-mono text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg"
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>MySQL Health API</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-12 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
            <span>Closed Feedback Loop: Plan → Train → Record → Analyze → Adapt</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Database-Driven <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Adaptive Fitness</span> Tracker
          </h1>

          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Powered 100% by MySQL. PhysiQ queries historical relational workout records to dynamically calculate overdue body parts, compute session volume via triggers, and estimate progressive overload targets.
          </p>
        </div>
      </section>

      {/* Core Architectural Pillars */}
      <section className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        {/* Pillar 1: Adaptive Decision Engine */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 hover:border-indigo-500/40 transition-all group">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Adaptive Training Engine</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Employs MySQL stored procedures (<code className="text-indigo-300 text-xs font-mono">sp_get_next_body_part</code>) and triggers to recommend overdue body parts derived directly from training history.
          </p>
          <div className="text-xs font-mono text-indigo-400 flex items-center gap-1">
            Dynamic Scheduling <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Pillar 2: 3NF Relational Foundation */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 hover:border-violet-500/40 transition-all group">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4 group-hover:scale-110 transition-transform">
            <Database className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">11-Table 3NF MySQL Core</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Fully normalized relational design with automated triggers for session volume, ACID transactions for workout logging, views for weekly analytics, and composite indexes.
          </p>
          <div className="text-xs font-mono text-violet-400 flex items-center gap-1">
            ACID Transactions &amp; Triggers <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Pillar 3: MySQL Progress & JSON Features */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 hover:border-pink-500/40 transition-all group">
          <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4 group-hover:scale-110 transition-transform">
            <Camera className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Progress &amp; Visual Tracking</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Stores progress photos and body measurement time-series in MySQL using JSON tag arrays, date indexing, and relational foreign keys to the active user.
          </p>
          <div className="text-xs font-mono text-pink-400 flex items-center gap-1">
            MySQL JSON &amp; Timeline <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        PhysiQ &bull; DBMS Level 3 Project &bull; Built with Next.js &amp; MySQL
      </footer>
    </main>
  );
}
