'use client';

import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

export type CarouselRound = {
  number: number;
  isCompleted: boolean;
};

type Props = {
  rounds: CarouselRound[];
  selectedRound: number;
  onSelectRound: (round: number) => void;
};

// The dark round-navigation header shared by Quick Match (wizard-form.tsx) and the community
// Live Board (live-board-wrapper.tsx) — the single place this UI is defined, so the two can't
// drift apart again the way they kept doing when each screen hand-copied its own version.
export default function RoundCarousel({ rounds, selectedRound, onSelectRound }: Props) {
  const totalRounds = rounds.length;

  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-white shadow-md space-y-3">
      {totalRounds > 0 ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelectRound(Math.max(1, selectedRound - 1))}
            disabled={selectedRound <= 1}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 transition-all text-xs font-extrabold cursor-pointer disabled:cursor-not-allowed text-white shadow-xs"
          >
            <ChevronLeft className="h-4 w-4 text-orange-400" />
            <span className="hidden sm:inline">Prev Round</span>
          </button>

          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 block">
              Match Round Navigation
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
              ROUND {selectedRound} <span className="text-zinc-500 font-normal">/ {totalRounds}</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onSelectRound(Math.min(totalRounds, selectedRound + 1))}
            disabled={selectedRound >= totalRounds}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 transition-all text-xs font-extrabold cursor-pointer disabled:cursor-not-allowed text-white shadow-xs"
          >
            <span className="hidden sm:inline">Next Round</span>
            <ChevronRight className="h-4 w-4 text-orange-400" />
          </button>
        </div>
      ) : (
        <div className="text-center py-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 block">
            Match Round Navigation
          </span>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">No Rounds Yet</h2>
        </div>
      )}

      {totalRounds > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2.5 border-t border-zinc-800/80 overflow-x-auto py-1">
          {rounds.map((r) => {
            const isSelected = r.number === selectedRound;
            return (
              <button
                key={r.number}
                type="button"
                onClick={() => onSelectRound(r.number)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  isSelected ? 'bg-orange-500 text-white shadow-sm' : 'bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                <span>Round {r.number}</span>
                {r.isCompleted && <Check className="h-3 w-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
