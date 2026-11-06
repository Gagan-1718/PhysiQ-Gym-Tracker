'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ArrowRightLeft, Play, Search, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { Exercise } from '@/types/database';
import type { VectorSearchHit } from '@/lib/vector';

const QUICK_PROMPTS = [
  'Lower back friendly leg builder',
  'Shoulder safe chest press',
  'Wide V-taper back & lats',
  'Joint friendly cable arm isolation',
  'Bicep peak & forearm thickness',
  'Glute & hamstring hinge builder',
  'Tricep horseshoe pressdown',
  'Rear delt & upper back posture',
  'Quad tear drop hypertrophy',
  'Core stabilizer & ab endurance',
];

interface VectorSearchResponse {
  domain: 'exercise';
  query: string;
  dimensions: number;
  metric: string;
  results: VectorSearchHit[];
}

export function SemanticExerciseFinder({
  exercises,
  onStartExercise,
}: {
  exercises: Exercise[];
  onStartExercise: (exercise: Exercise) => void;
}) {
  const [query, setQuery] = useState(QUICK_PROMPTS[0]);
  const [similarToId, setSimilarToId] = useState<number | null>(null);

  const url = similarToId
    ? `/api/vector/search?domain=exercise&similarTo=${similarToId}&k=4`
    : query.trim().length >= 2
      ? `/api/vector/search?domain=exercise&q=${encodeURIComponent(query.trim())}&k=4`
      : null;

  const { data } = useSWR<VectorSearchResponse>(url);

  const byId = new Map(exercises.map((e) => [e.id, e]));

  return (
    <Card aria-label="Semantic vector exercise finder">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-train/15 px-2.5 py-0.5 text-xs font-bold text-train">
            <Sparkles className="h-3.5 w-3.5" /> Vector KNN Search
          </span>
          <span className="text-xs text-fg-3">32-d Cosine Similarity</span>
        </div>
      </div>

      {/* Natural language search input */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
        <input
          type="search"
          aria-label="Semantic exercise search"
          placeholder="Describe movement, muscle, or joint constraint..."
          value={query}
          onChange={(e) => {
            setSimilarToId(null);
            setQuery(e.target.value);
          }}
          className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-4 text-[15px] text-fg placeholder:text-fg-3 focus:border-accent/60 focus:outline-none"
        />
      </div>

      {/* Prompt chips */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((p) => {
          const active = !similarToId && query === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                setSimilarToId(null);
                setQuery(p);
              }}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-accent-solid text-white'
                  : 'bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Results list */}
      {data && data.results.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs font-semibold text-fg-3">
            Top vector matches for <span className="text-fg-2">“{data.query}”</span>
          </p>
          <ul className="divide-y divide-line">
            {data.results.map((hit) => {
              const ex = byId.get(hit.entity_id);
              return (
                <li key={hit.entity_id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold text-fg">{hit.title}</span>
                      <span className="tabular rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-bold text-water">
                        {hit.match_pct}% · cos {hit.cosine_similarity.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg-3">{hit.subtitle}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSimilarToId(hit.entity_id)}
                      aria-label={`Find similar alternatives to ${hit.title}`}
                      title="Find biomechanically similar alternatives"
                      className="press inline-flex h-8 items-center gap-1 rounded-lg bg-surface-2 px-2 text-xs font-semibold text-fg-2 hover:bg-surface-3 hover:text-fg"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Similar
                    </button>
                    {ex && (
                      <button
                        type="button"
                        onClick={() => onStartExercise(ex)}
                        aria-label={`Start workout with ${hit.title}`}
                        className="press inline-flex h-8 items-center gap-1 rounded-lg bg-accent-solid px-2.5 text-xs font-bold text-white"
                      >
                        <Play className="h-3 w-3 fill-current" /> Train
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
