'use client';

import { useState } from 'react';
import { Printer, ChevronUp } from 'lucide-react';
import LeaderboardPoster, { type PosterStanding } from '@/components/leaderboard-poster';

type Props = {
  activityName: string;
  gameType: string;
  sport: string;
  standings: PosterStanding[];
};

export default function LeaderboardPrintSection({ activityName, gameType, sport, standings }: Props) {
  const [showPoster, setShowPoster] = useState(false);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setShowPoster((v) => !v)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm"
      >
        {showPoster ? <ChevronUp className="h-4 w-4" /> : <Printer className="h-4 w-4" />}
        <span>{showPoster ? 'Hide Leaderboard' : 'Print Final Leaderboard'}</span>
      </button>

      {showPoster && (
        <LeaderboardPoster activityName={activityName} gameType={gameType} sport={sport} standings={standings} />
      )}
    </div>
  );
}
