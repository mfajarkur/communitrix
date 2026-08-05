'use client';

import { Zap, Trophy, Check } from 'lucide-react';

export type CarouselRound = {
  number: number;
  isCompleted: boolean;
};

type Props = {
  viewMode: 'MATCHES' | 'LEADERBOARD';
  onViewModeChange: (value: 'MATCHES' | 'LEADERBOARD') => void;
  rounds: CarouselRound[];
  selectedRound: number;
  onSelectRound: (round: number) => void;
};

// One shape, two rows: the Live Matches/Leaderboard switcher on top, the round tabs directly
// below it with no gap — replaces what used to be two separate floating boxes (LiveLeaderboardTabs
// + RoundCarousel) stacked with space between them. Shared by Quick Match (wizard-form.tsx) and
// the community Live Board (live-board-wrapper.tsx).
//
// Round tabs use the same "active tab spells out the number, every other tab collapses to RN"
// idea as the carousel they replaced, so the strip stays compact no matter how many rounds a
// session accumulates. Hidden entirely while viewing the Leaderboard, since round selection has
// no meaning there.
export default function SessionViewTabs({ viewMode, onViewModeChange, rounds, selectedRound, onSelectRound }: Props) {
  const showRounds = viewMode === 'MATCHES';

  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950 shadow-md overflow-hidden">
      <div className="flex items-center gap-1 p-1.5">
        <button
          type="button"
          onClick={() => onViewModeChange('MATCHES')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            viewMode === 'MATCHES' ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Live Matches</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('LEADERBOARD')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            viewMode === 'LEADERBOARD' ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          <span>Leaderboard</span>
        </button>
      </div>

      {showRounds && (
        <div className="border-t border-zinc-800/80">
          {rounds.length === 0 ? (
            <div className="px-4 py-2 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">No Rounds Yet</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin px-1.5 py-1.5">
              {rounds.map((r) => {
                const isSelected = r.number === selectedRound;
                return (
                  <button
                    key={r.number}
                    type="button"
                    onClick={() => onSelectRound(r.number)}
                    title={`Round ${r.number}`}
                    className={`shrink-0 flex items-center gap-1 rounded-lg font-black transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500 text-white px-3 py-1.5 text-[11px] shadow-sm'
                        : 'bg-zinc-800/70 text-zinc-400 hover:bg-zinc-700 hover:text-white px-2 py-1 text-[10px]'
                    }`}
                  >
                    <span>{isSelected ? `Round ${r.number}` : `R${r.number}`}</span>
                    {r.isCompleted && <Check className={`h-2.5 w-2.5 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
