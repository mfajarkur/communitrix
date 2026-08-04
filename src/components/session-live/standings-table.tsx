'use client';

export type StandingsRow = {
  rank: number;
  playerId?: string;
  name: string;
  totalPoints: number;
  wins: number;
  losses: number;
  ties: number;
  diff?: number;
  realMatchesPlayed?: number;
  // Quick Match only — community rows never set these, so those bits simply don't render.
  isGuest?: boolean;
  byePoints?: number;
  byeIsPlaceholder?: boolean;
};

type Props = {
  standings: StandingsRow[];
};

// The ranked Rank/Player/M/W-L-T/D/P table with medal badges, shared by Quick Match and the
// community Live Board — see round-carousel.tsx for why this is extracted. Columns are
// abbreviated (M/D/P) and tightly packed so the table fits without horizontal scroll on most
// screens; the legend row below the table spells them out.
export default function StandingsTable({ standings }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden space-y-2">
      <div className="overflow-x-auto p-3 sm:p-4 scrollbar-thin scrollbar-thumb-zinc-200">
        <table className="w-full text-left text-xs sm:text-sm font-sans min-w-[380px]">
          <thead>
            <tr className="border-b border-zinc-100 text-zinc-400 font-extrabold uppercase text-[10px] tracking-wider">
              <th className="pb-2 pl-1 sm:pl-2">Rank</th>
              <th className="pb-2 w-[100px] sm:w-auto">Player</th>
              <th className="pb-2 text-center px-1 sm:px-3">M</th>
              <th className="pb-2 text-center px-1 sm:px-3">W-L-T</th>
              <th className="pb-2 text-center px-1 sm:px-3">D</th>
              <th className="pb-2 text-right pr-1 sm:pr-2">P</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {standings.map((s) => (
              <tr key={s.playerId ?? s.name} className="hover:bg-zinc-50/60 transition-colors">
                <td className="py-2 pl-1 sm:pl-2 font-black text-sm sm:text-base text-[#111827]">
                  {s.rank === 1 ? (
                    <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-amber-400 text-white font-black text-xs shadow-sm">
                      1
                    </span>
                  ) : s.rank === 2 ? (
                    <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-zinc-300 text-zinc-800 font-black text-xs shadow-sm">
                      2
                    </span>
                  ) : s.rank === 3 ? (
                    <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-amber-700 text-white font-black text-xs shadow-sm">
                      3
                    </span>
                  ) : (
                    `#${s.rank}`
                  )}
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-1.5 sm:gap-2.5">
                    <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] sm:text-xs font-bold text-zinc-600 uppercase shrink-0">
                      {s.name.slice(0, 2)}
                    </div>
                    <div className="truncate max-w-[70px] sm:max-w-[180px] md:max-w-[260px] lg:max-w-none">
                      <p className="font-bold text-zinc-900 truncate">{s.name}</p>
                      {s.isGuest && (
                        <span className="text-[9px] uppercase font-extrabold bg-amber-100 text-amber-800 px-1 rounded">
                          Guest
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2 text-center px-1 sm:px-3 font-bold text-zinc-900">
                  {s.realMatchesPlayed ?? s.wins + s.losses + s.ties}
                </td>
                <td className="py-2 text-center px-1 sm:px-3 font-mono font-bold text-zinc-700">
                  {s.wins}-{s.losses}-{s.ties}
                </td>
                <td className="py-2 text-center px-1 sm:px-3 font-mono font-bold text-zinc-900">
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-xs ${
                      (s.diff ?? 0) > 0
                        ? 'bg-emerald-50 text-emerald-700 font-extrabold'
                        : (s.diff ?? 0) < 0
                        ? 'bg-rose-50 text-rose-600 font-extrabold'
                        : 'text-zinc-500'
                    }`}
                  >
                    {(s.diff ?? 0) > 0 ? `+${s.diff}` : s.diff ?? 0}
                  </span>
                </td>
                <td className="py-2 text-right pr-1 sm:pr-2 font-black text-sm sm:text-base text-[#111827] whitespace-nowrap">
                  {s.totalPoints}
                  {(s.byePoints ?? 0) > 0 && (
                    <span
                      title={
                        s.byeIsPlaceholder
                          ? `Includes ${s.byePoints} placeholder point${s.byePoints === 1 ? '' : 's'} for a round not yet played (no match history yet)`
                          : `Includes ${s.byePoints} bye point${s.byePoints === 1 ? '' : 's'} (estimated from this player's average, for a round they sat out)`
                      }
                      className={`text-[9px] font-bold ml-1 px-1 py-0.5 rounded uppercase tracking-wide ${
                        s.byeIsPlaceholder ? 'text-zinc-500 bg-zinc-100' : 'text-amber-700 bg-amber-100'
                      }`}
                    >
                      {s.byePoints} bye
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-center text-[9px] text-zinc-400 font-medium py-2 bg-zinc-50 border-t border-zinc-100">
        M = Matches · W-L-T = Wins-Losses-Ties · D = Diff · P = Points (bye points already included, badge shows how many)
      </div>
    </div>
  );
}
