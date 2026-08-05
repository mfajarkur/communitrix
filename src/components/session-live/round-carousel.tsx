'use client';

import { Check } from 'lucide-react';

export type CarouselRound = {
  number: number;
  isCompleted: boolean;
};

type Props = {
  rounds: CarouselRound[];
  selectedRound: number;
  onSelectRound: (round: number) => void;
};

// Chrome-tab-style round switcher — shared by Quick Match (wizard-form.tsx) and the community
// Live Board (live-board-wrapper.tsx). One tab per round, added to the end as new rounds get
// generated. The active tab spells out "Round N"; every other tab collapses to "RN" so the
// whole strip stays compact — a scrollable row of small pills, not a full header — no matter how
// many rounds a long session accumulates.
export default function RoundCarousel({ rounds, selectedRound, onSelectRound }: Props) {
  if (rounds.length === 0) {
    return (
      <div className="rounded-xl bg-zinc-950 px-4 py-2.5 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">No Rounds Yet</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin bg-zinc-950 rounded-t-xl px-1.5 pt-1.5">
      {rounds.map((r) => {
        const isSelected = r.number === selectedRound;
        return (
          <button
            key={r.number}
            type="button"
            onClick={() => onSelectRound(r.number)}
            title={`Round ${r.number}`}
            className={`shrink-0 flex items-center gap-1 rounded-t-lg font-black transition-all cursor-pointer ${
              isSelected
                ? 'bg-orange-500 text-white px-3.5 py-2 text-xs shadow-sm'
                : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white px-2.5 py-1.5 text-[11px]'
            }`}
          >
            <span>{isSelected ? `Round ${r.number}` : `R${r.number}`}</span>
            {r.isCompleted && <Check className={`h-3 w-3 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />}
          </button>
        );
      })}
    </div>
  );
}
