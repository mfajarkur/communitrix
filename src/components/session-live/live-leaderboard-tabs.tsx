'use client';

import { Zap, Trophy } from 'lucide-react';

type Props = {
  value: 'MATCHES' | 'LEADERBOARD';
  onChange: (value: 'MATCHES' | 'LEADERBOARD') => void;
};

// "LIVE MATCHES / LEADERBOARD" pill switcher shared by Quick Match and the community Live
// Board — see round-carousel.tsx for why this is extracted rather than duplicated per screen.
export default function LiveLeaderboardTabs({ value, onChange }: Props) {
  return (
    <div className="w-full pb-2 border-b border-zinc-100">
      <div className="flex p-1 bg-zinc-100 rounded-2xl max-w-md mx-auto shadow-inner">
        <button
          type="button"
          onClick={() => onChange('MATCHES')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
            value === 'MATCHES' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>LIVE MATCHES</span>
        </button>
        <button
          type="button"
          onClick={() => onChange('LEADERBOARD')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
            value === 'LEADERBOARD' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>LEADERBOARD</span>
        </button>
      </div>
    </div>
  );
}
