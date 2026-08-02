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

// The ranked Rank/Player/Matches/W-L-T/Diff/Points table with medal badges, shared by Quick
// Match and the community Live Board — see round-carousel.tsx for why this is extracted.
export default function StandingsTable({ standings }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden space-y-2">
      <div className="overflow-x-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-zinc-200">
        <table className="w-full text-left text-xs font-sans min-w-[560px]">
          <thead>
            <tr className="border-b border-zinc-100 text-zinc-400 font-extrabold uppercase text-[10px] tracking-wider">
              <th className="pb-3 pl-2">Rank</th>
              <th className="pb-3 w-[135px]">Player</th>
              <th className="pb-3 text-center">Matches</th>
              <th className="pb-3 text-center">W-L-T</th>
              <th className="pb-3 text-center">Diff</th>
              <th className="pb-3 text-right pr-2">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {standings.map((s) => (
              <tr key={s.playerId ?? s.name} className="hover:bg-zinc-50/60 transition-colors">
                <td className="py-3 pl-2 font-black text-sm text-[#111827]">
                  {s.rank === 1 ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white font-black text-xs shadow-sm">
                      1
                    </span>
                  ) : s.rank === 2 ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-300 text-zinc-800 font-black text-xs shadow-sm">
                      2
                    </span>
                  ) : s.rank === 3 ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-white font-black text-xs shadow-sm">
                      3
                    </span>
                  ) : (
                    `#${s.rank}`
                  )}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-600 uppercase shrink-0">
                      {s.name.slice(0, 2)}
                    </div>
                    <div className="truncate max-w-[90px]">
                      <p className="font-bold text-zinc-900 truncate">{s.name}</p>
                      {s.isGuest && (
                        <span className="text-[9px] uppercase font-extrabold bg-amber-100 text-amber-800 px-1 rounded">
                          Guest
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 text-center font-bold text-zinc-900">
                  {s.realMatchesPlayed ?? s.wins + s.losses + s.ties}
                </td>
                <td className="py-3 text-center font-mono font-bold text-zinc-700">
                  {s.wins}-{s.losses}-{s.ties}
                </td>
                <td className="py-3 text-center font-mono font-bold text-zinc-900">
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs ${
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
                <td className="py-3 text-right pr-2 font-black text-sm text-[#111827] whitespace-nowrap">
                  {s.byePoints && s.byePoints > 0 ? (
                    <span
                      title={
                        s.byeIsPlaceholder
                          ? 'Temporary placeholder score (no actual matches played yet)'
                          : 'Dynamic bye points based on player average'
                      }
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md mr-1.5 border ${
                        s.byeIsPlaceholder
                          ? 'text-zinc-500 bg-zinc-100 border-zinc-300'
                          : 'text-amber-700 bg-amber-100 border-amber-300'
                      }`}
                    >
                      {s.byeIsPlaceholder ? '~' : '+'}
                      {s.byePoints} Bye
                    </span>
                  ) : null}
                  {s.totalPoints}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="block sm:hidden text-center text-[10px] text-zinc-400 font-medium py-2 bg-zinc-50 border-t border-zinc-100">
        ← Scroll horizontally to view full stats →
      </div>
    </div>
  );
}
