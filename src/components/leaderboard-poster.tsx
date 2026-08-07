'use client';

import { useState } from 'react';
import { Trophy, Crown, Download, Loader2, Zap } from 'lucide-react';

export type PosterStanding = {
  rank: number;
  playerId?: string;
  name: string;
  totalPoints: number;
  wins: number;
  losses: number;
  ties: number;
  diff?: number;
  realMatchesPlayed?: number;
  byePoints?: number;
  byesCount?: number;
  byeIsPlaceholder?: boolean;
  avatarUrl?: string | null;
};

type Props = {
  activityName: string;
  gameType: string;
  sport: string;
  standings: PosterStanding[];
};

// The exact "podium" leaderboard poster shown when a match ends — extracted so it can be
// reused both right after finishing a match (WizardForm) and later from a saved match's
// history recap page, where it doubles as a "print / save this leaderboard" view.
export default function LeaderboardPoster({ activityName, gameType, sport, standings }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);

  const firstPlace = standings.find((s) => s.rank === 1) || standings[0];
  const secondPlace = standings.find((s) => s.rank === 2) || standings[1];
  const thirdPlace = standings.find((s) => s.rank === 3) || standings[2];

  const handleDownloadImage = async () => {
    setIsDownloading(true);
    try {
      const { toBlob } = await import('html-to-image');
      const node = document.getElementById('podium-download-area');
      if (!node) {
        setIsDownloading(false);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const targetWidth = node.offsetWidth;
      const targetHeight = node.offsetHeight;

      const blob = await toBlob(node, {
        cacheBust: true,
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        width: targetWidth,
        height: targetHeight,
        style: {
          margin: '0px',
          transform: 'none',
        },
      });

      if (!blob) {
        throw new Error('Generated image blob is null');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `communitrix-${activityName.toLowerCase().replace(/\s+/g, '-')}-results.png`;
      link.href = url;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download image', err);
      alert('Failed to export standings as image. Please take a screenshot or try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="overflow-x-auto w-full pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
        <div
          id="podium-download-area"
          className="w-full max-w-[420px] mx-auto bg-white text-zinc-900 p-5 sm:p-6 border border-zinc-200 relative shadow-2xl overflow-hidden bg-gradient-to-br from-white via-orange-50 to-zinc-50"
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
          <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />

          <div className="flex justify-between items-center border-b border-zinc-200 pb-4 mb-6 shrink-0 relative z-10">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                COMMUNITRIX
              </span>
              <h4 className="text-sm font-black uppercase tracking-tight text-zinc-900 mt-0.5">
                {activityName}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase font-extrabold text-zinc-400 block">Format & Sport</span>
              <span className="text-xs font-bold text-zinc-600">{gameType} ({sport})</span>
            </div>
          </div>

          <div className="text-center relative z-10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-500 animate-celebrate shadow-sm mb-2">
              <Trophy className="h-6 w-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              Final Leaderboard
            </h2>
          </div>

          <div className="flex justify-center items-end gap-2 sm:gap-4 pt-4 pb-6 max-w-sm mx-auto relative border-b border-zinc-200 z-10">
            {secondPlace && (
              <div className="flex flex-col items-center flex-1">
                <div className="w-full h-44 sm:h-52 bg-gradient-to-t from-zinc-200 to-zinc-50 flex flex-col items-center justify-end pb-5 border border-zinc-200/80 shadow-inner relative overflow-hidden">
                  {secondPlace.avatarUrl && (
                    <img
                      src={secondPlace.avatarUrl}
                      alt={secondPlace.name}
                      className="absolute inset-0 w-full h-full object-cover object-top brightness-105 saturate-0"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-200 from-20% via-zinc-200/40 to-transparent pointer-events-none" />
                  <span className="text-5xl sm:text-6xl font-black text-zinc-600 drop-shadow-md relative z-10 leading-none">2</span>
                  <span className="text-[9px] uppercase tracking-wider font-black text-zinc-700 relative z-10 mt-1">SILVER</span>
                </div>
                <div className="mt-3 flex flex-col items-center">
                  <p className="text-sm sm:text-base font-black text-zinc-900 text-center truncate max-w-[80px]">
                    {secondPlace.name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-zinc-500 font-black mt-0.5">
                    {secondPlace.wins}-{secondPlace.losses}-{secondPlace.ties} • {secondPlace.totalPoints} pts
                  </p>
                </div>
              </div>
            )}

            {firstPlace && (
              <div className="flex flex-col items-center flex-1 z-10">
                <div className="w-full h-56 sm:h-64 bg-gradient-to-t from-orange-600 to-orange-400 flex flex-col items-center justify-end pb-6 border border-orange-400 shadow-xl shadow-orange-500/20 text-white relative overflow-hidden">
                  {firstPlace.avatarUrl && (
                    <img
                      src={firstPlace.avatarUrl}
                      alt={firstPlace.name}
                      className="absolute inset-0 w-full h-full object-cover object-top brightness-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-600 from-20% via-orange-500/40 to-transparent pointer-events-none" />
                  <span className="text-6xl sm:text-7xl font-black text-white drop-shadow-lg relative z-10 leading-none">1</span>
                  <span className="text-[10px] uppercase tracking-wider font-black text-orange-100 relative z-10 mt-1">GOLD</span>
                </div>
                <div className="mt-3 flex flex-col items-center">
                  <p className="text-sm sm:text-base font-black text-zinc-900 text-center truncate max-w-[100px]">
                    {firstPlace.name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-orange-600 font-black mt-0.5">
                    {firstPlace.wins}-{firstPlace.losses}-{firstPlace.ties} • {firstPlace.totalPoints} pts
                  </p>
                </div>
              </div>
            )}

            {thirdPlace && (
              <div className="flex flex-col items-center flex-1">
                <div className="w-full h-36 sm:h-44 bg-gradient-to-t from-orange-200 to-orange-50 flex flex-col items-center justify-end pb-4 border border-orange-200/80 shadow-inner relative overflow-hidden">
                  {thirdPlace.avatarUrl && (
                    <img
                      src={thirdPlace.avatarUrl}
                      alt={thirdPlace.name}
                      className="absolute inset-0 w-full h-full object-cover object-top brightness-105 saturate-50"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-200 from-20% via-orange-100/40 to-transparent pointer-events-none" />
                  <span className="text-4xl sm:text-5xl font-black text-orange-700 drop-shadow-md relative z-10 leading-none">3</span>
                  <span className="text-[8px] uppercase tracking-wider font-black text-orange-800 relative z-10 mt-1">BRONZE</span>
                </div>
                <div className="mt-3 flex flex-col items-center">
                  <p className="text-sm sm:text-base font-black text-zinc-900 text-center truncate max-w-[80px]">
                    {thirdPlace.name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-zinc-500 font-black mt-0.5">
                    {thirdPlace.wins}-{thirdPlace.losses}-{thirdPlace.ties} • {thirdPlace.totalPoints} pts
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-6 relative z-10 max-w-xl mx-auto w-full">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 pl-2">
              Complete Standings
            </h3>
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-md overflow-hidden">
              <div className="overflow-x-auto p-3 sm:p-4 scrollbar-thin scrollbar-thumb-zinc-200">
                <table className="w-full text-left text-xs font-sans text-zinc-900">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-400 font-black uppercase text-[9px] tracking-wider">
                      <th className="pb-2 pl-1 w-8">Rank</th>
                      <th className="pb-2 w-auto">Player</th>
                      <th className="pb-2 text-center w-8">P</th>
                      <th className="pb-2 text-center w-12">W-L-T</th>
                      <th className="pb-2 text-center w-10">Diff</th>
                      <th className="pb-2 text-right pr-1 w-10">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {standings.map((s) => (
                      <tr key={s.playerId ?? s.name} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-2.5 pl-1 font-black text-[11px] text-zinc-500 w-8">
                          {s.rank === 1 ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-black text-[10px] shadow-sm">
                              1
                            </span>
                          ) : s.rank === 2 ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 font-black text-[10px] shadow-sm">
                              2
                            </span>
                          ) : s.rank === 3 ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-50 text-orange-800 font-black text-[10px] shadow-sm">
                              3
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-bold">#{s.rank}</span>
                          )}
                        </td>
                        <td className="py-2.5 w-auto">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-600 uppercase shrink-0">
                              {s.name.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-extrabold text-zinc-900 truncate max-w-[80px]">{s.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 text-center font-bold text-zinc-600 w-8">
                          {s.realMatchesPlayed !== undefined ? s.realMatchesPlayed : (s.wins + s.losses + s.ties)}
                        </td>
                        <td className="py-2.5 text-center font-mono font-black text-zinc-700 w-12 text-[10px]">
                          {s.wins}-{s.losses}-{s.ties}
                        </td>
                        <td className="py-2.5 text-center font-mono font-bold w-10">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            (s.diff ?? 0) > 0
                              ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                              : (s.diff ?? 0) < 0
                              ? 'bg-rose-100 text-rose-700 shadow-sm'
                              : 'text-zinc-500 bg-zinc-100'
                          }`}>
                            {(s.diff ?? 0) > 0 ? `+${s.diff}` : s.diff ?? 0}
                          </span>
                        </td>
                        <td className="py-2.5 text-right pr-1 font-black text-[11px] text-orange-600 w-10">
                          {s.totalPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center border-t border-zinc-200 pt-6 mt-6 shrink-0 relative z-10 gap-1 text-center">
            <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase flex items-center gap-1">
              <Zap className="h-3 w-3 text-orange-500 animate-pulse" />
              Powered by
            </span>
            <span className="text-xs font-extrabold text-orange-600 tracking-wider uppercase">
              communitrix.id
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownloadImage}
        disabled={isDownloading}
        className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-550/70 text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
      >
        {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        <span>{isDownloading ? 'Exporting Image...' : '📥 Download as Image'}</span>
      </button>
    </div>
  );
}
