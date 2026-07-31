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

      const targetWidth = 640;
      const targetHeight = node.offsetHeight;

      const blob = await toBlob(node, {
        cacheBust: true,
        backgroundColor: '#09090b',
        width: targetWidth,
        height: targetHeight,
        style: {
          borderRadius: '0px',
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
          margin: '0px',
          padding: '32px',
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
          className="w-[640px] shrink-0 mx-auto bg-zinc-950 text-white p-6 sm:p-8 rounded-3xl border border-orange-500/25 relative shadow-2xl overflow-hidden bg-gradient-to-br from-[#09090b] via-[#2c0f02] to-[#09090b]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
          <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          <div className="flex justify-between items-center border-b border-zinc-800/80 pb-4 mb-6 shrink-0 relative z-10">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                COMMUNITRIX
              </span>
              <h4 className="text-sm font-black uppercase tracking-tight text-white mt-0.5">
                {activityName}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase font-extrabold text-zinc-500 block">Format & Sport</span>
              <span className="text-xs font-bold text-zinc-350">{gameType} ({sport})</span>
            </div>
          </div>

          <div className="text-center space-y-2 relative z-10 py-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 animate-celebrate shadow-sm">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              Final Match Standings
            </h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto font-light leading-relaxed">
              Match session completed! Here are the champions and final player rankings.
            </p>
          </div>

          <div className="flex justify-center items-end gap-3 sm:gap-6 pt-12 pb-6 max-w-md mx-auto relative border-b border-zinc-800/80 z-10">
            {secondPlace && (
              <div className="flex flex-col items-center flex-1">
                <div className="relative mb-2.5 flex flex-col items-center">
                  <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full border-3 border-zinc-400 bg-zinc-900 flex items-center justify-center text-sm sm:text-base font-bold text-zinc-300 uppercase shadow-md shrink-0">
                    {secondPlace.name.slice(0, 2)}
                  </div>
                  <p className="text-[11px] font-bold text-zinc-200 mt-2 text-center truncate max-w-[80px] sm:max-w-[100px]">
                    {secondPlace.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-bold">{secondPlace.totalPoints} pts</p>
                </div>
                <div className="w-full h-24 sm:h-32 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 rounded-t-xl flex flex-col items-center justify-center border border-zinc-700/50 shadow-md">
                  <span className="text-3xl sm:text-4xl font-black text-zinc-300 drop-shadow-sm">2</span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-450">Silver</span>
                </div>
              </div>
            )}

            {firstPlace && (
              <div className="flex flex-col items-center flex-1 z-10">
                <div className="relative mb-2.5 flex flex-col items-center">
                  <Crown className="h-6 w-6 text-amber-400 absolute -top-5 transform -rotate-12" />
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-amber-500 bg-zinc-900 flex items-center justify-center text-base sm:text-lg font-black text-amber-400 uppercase shadow-lg shadow-amber-450/20 shrink-0">
                    {firstPlace.name.slice(0, 2)}
                  </div>
                  <p className="text-xs sm:text-sm font-extrabold text-white mt-2 text-center truncate max-w-[90px] sm:max-w-[120px]">
                    {firstPlace.name}
                  </p>
                  <p className="text-[11px] text-amber-400 font-black">{firstPlace.totalPoints} pts</p>
                </div>
                <div className="w-full h-32 sm:h-40 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 rounded-t-2xl flex flex-col items-center justify-center border border-amber-500/50 shadow-xl shadow-amber-500/10">
                  <span className="text-4xl sm:text-5xl font-black text-amber-100 drop-shadow-md">1</span>
                  <span className="text-[10px] uppercase tracking-wider font-black text-amber-900/90">Champion</span>
                </div>
              </div>
            )}

            {thirdPlace && (
              <div className="flex flex-col items-center flex-1">
                <div className="relative mb-2.5 flex flex-col items-center">
                  <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full border-3 border-amber-800 bg-zinc-900 flex items-center justify-center text-xs sm:text-sm font-bold text-amber-650 uppercase shadow-sm shrink-0">
                    {thirdPlace.name.slice(0, 2)}
                  </div>
                  <p className="text-[11px] font-bold text-zinc-200 mt-2 text-center truncate max-w-[80px] sm:max-w-[100px]">
                    {thirdPlace.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-bold">{thirdPlace.totalPoints} pts</p>
                </div>
                <div className="w-full h-18 sm:h-24 bg-gradient-to-b from-amber-800 via-orange-950 to-amber-950 rounded-t-xl flex flex-col items-center justify-center border border-amber-800/40 shadow-sm">
                  <span className="text-2xl sm:text-3xl font-black text-amber-500 drop-shadow-2xs">3</span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-400/70">Bronze</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-6 relative z-10 max-w-xl mx-auto w-full">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-550 pl-2">
              Complete Standings
            </h3>
            <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-600 to-amber-600 shadow-lg overflow-hidden">
              <div className="overflow-x-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-orange-100/30">
                <table className="w-full text-left text-xs font-sans text-white">
                  <thead>
                    <tr className="border-b border-white/20 text-orange-100 font-black uppercase text-[10px] tracking-wider">
                      <th className="pb-3 pl-2 w-12 sm:w-16">Rank</th>
                      <th className="pb-3 w-auto">Player</th>
                      <th className="pb-3 text-center w-16 sm:w-20">Matches</th>
                      <th className="pb-3 text-center w-20 sm:w-24">W-L-T</th>
                      <th className="pb-3 text-center w-16 sm:w-20">Diff</th>
                      <th className="pb-3 text-right pr-2 w-16 sm:w-20">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {standings.map((s) => (
                      <tr key={s.playerId ?? s.name} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pl-2 font-black text-sm text-white w-12 sm:w-16">
                          {s.rank === 1 ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-orange-600 font-black text-xs shadow-sm">
                              1
                            </span>
                          ) : s.rank === 2 ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-zinc-900 font-black text-xs shadow-sm">
                              2
                            </span>
                          ) : s.rank === 3 ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-900 text-amber-100 font-black text-xs shadow-sm">
                              3
                            </span>
                          ) : (
                            <span className="text-orange-100 font-bold">#{s.rank}</span>
                          )}
                        </td>
                        <td className="py-3 w-auto">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-xs font-bold text-white uppercase shrink-0">
                              {s.name.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-extrabold text-white truncate max-w-[120px] sm:max-w-none">{s.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-center font-bold text-white w-16 sm:w-20">
                          {s.realMatchesPlayed !== undefined ? s.realMatchesPlayed : (s.wins + s.losses + s.ties)}
                        </td>
                        <td className="py-3 text-center font-mono font-black text-white w-20 sm:w-24">
                          {s.wins}-{s.losses}-{s.ties}
                        </td>
                        <td className="py-3 text-center font-mono font-bold w-16 sm:w-20">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-black ${
                            (s.diff ?? 0) > 0
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : (s.diff ?? 0) < 0
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'text-white bg-white/10'
                          }`}>
                            {(s.diff ?? 0) > 0 ? `+${s.diff}` : s.diff ?? 0}
                          </span>
                        </td>
                        <td className="py-3 text-right pr-2 font-black text-sm text-white w-16 sm:w-20">
                          {s.totalPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center border-t border-zinc-800/80 pt-6 mt-6 shrink-0 relative z-10 gap-1 text-center">
            <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase flex items-center gap-1">
              <Zap className="h-3 w-3 text-orange-500 animate-pulse" />
              Powered by
            </span>
            <span className="text-xs font-extrabold text-orange-500 tracking-wider uppercase">
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
