'use client';

import { useState, useEffect } from 'react';
import { Trophy, Crown, Download, Loader2, Zap } from 'lucide-react';

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

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
  hideDiff?: boolean;
};

// The exact "podium" leaderboard poster shown when a match ends — extracted so it can be
// reused both right after finishing a match (WizardForm) and later from a saved match's
// history recap page, where it doubles as a "print / save this leaderboard" view.
export default function LeaderboardPoster({ activityName, gameType, sport, standings }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isIosOrSafari, setIsIosOrSafari] = useState(false);

  useEffect(() => {
    setIsIosOrSafari(/iPad|iPhone|iPod/.test(navigator.userAgent) || /^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  const firstPlace = standings.find((s) => s.rank === 1) || standings[0];
  const secondPlace = standings.find((s) => s.rank === 2) || standings[1];
  const thirdPlace = standings.find((s) => s.rank === 3) || standings[2];

  const exportAndShare = async (blob: Blob, filename: string) => {
    const file = new File([blob], filename, { type: blob.type });
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    
    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Communitrix Leaderboard',
        });
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.warn('Share failed, falling back to download', error);
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

      const options = {
        cacheBust: true,
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        width: targetWidth,
        height: targetHeight,
        style: {
          margin: '0px',
          transform: 'none',
        },
      };

      // iOS Safari hack: render twice to fix ghosting/glitches
      const isIosOrSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) || /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isIosOrSafari) {
        await toBlob(node, options);
      }
      
      const blob = await toBlob(node, options);

      if (!blob) {
        throw new Error('Generated image blob is null');
      }

      const filename = `communitrix-${activityName.toLowerCase().replace(/\s+/g, '-')}-results.png`;
      await exportAndShare(blob, filename);
    } catch (err) {
      console.error('Failed to download image', err);
      alert('Failed to export standings as image. Please take a screenshot or try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const [isDownloadingIG, setIsDownloadingIG] = useState(false);

  const handleDownloadIGStory = async () => {
    setIsDownloadingIG(true);
    try {
      const { toBlob } = await import('html-to-image');
      const node = document.getElementById('ig-story-download-area');
      if (!node) throw new Error('IG Story node not found');

      const options = {
        cacheBust: true,
        backgroundColor: '#ffffff',
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        pixelRatio: 2.5, // 432x768 * 2.5 = 1080x1920
        style: {
          margin: '0px',
          transform: 'none',
        },
      };

      // iOS Safari hack: render twice to fix ghosting/glitches
      const isIosOrSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) || /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isIosOrSafari) {
        await toBlob(node, options);
      }
      
      const blob = await toBlob(node, options);

      if (!blob) throw new Error('Generated image blob is null');

      const filename = `communitrix-${activityName.toLowerCase().replace(/\s+/g, '-')}-ig-story.png`;
      await exportAndShare(blob, filename);
    } catch (err) {
      console.error('Failed to download IG story', err);
      alert('Failed to export IG Story. Please try again.');
    } finally {
      setIsDownloadingIG(false);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="overflow-x-auto w-full pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
          <div
          id="podium-download-area"
          className={`w-full max-w-[420px] mx-auto bg-white text-zinc-900 p-5 sm:p-6 border border-zinc-200 relative overflow-hidden bg-gradient-to-br from-white via-orange-50 to-zinc-50 ${isDownloading ? '' : 'shadow-2xl'}`}
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
          <div className={`absolute -top-40 -left-40 h-80 w-80 rounded-full bg-orange-500/20 pointer-events-none ${isDownloading ? 'hidden' : 'blur-3xl'}`} />
          <div className={`absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-orange-600/10 pointer-events-none ${isDownloading ? 'hidden' : 'blur-3xl'}`} />

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
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-500 mb-2 ${isDownloading ? '' : 'animate-celebrate shadow-sm'}`}>
              <Trophy className="h-6 w-6" />
            </div>
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-wider ${isDownloading ? 'text-orange-600' : 'bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent'}`}>
              Final Leaderboard
            </h2>
          </div>

          <div className="flex justify-center items-end gap-2 sm:gap-4 pt-4 pb-6 max-w-sm mx-auto relative border-b border-zinc-200 z-10">
            {secondPlace && (
              <div className="flex flex-col items-center flex-1">
                <div className={`w-full h-44 sm:h-52 bg-gradient-to-t from-zinc-200 to-zinc-50 flex flex-col items-center justify-end pb-5 border border-zinc-200/80 relative overflow-hidden ${isDownloading ? '' : 'shadow-inner'}`}>
                  {secondPlace.avatarUrl && (
                    <img
                      src={secondPlace.avatarUrl}
                      alt={secondPlace.name}
                      className="absolute inset-0 w-full h-full object-cover object-top brightness-105 saturate-0"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-200 from-20% via-zinc-200/40 to-transparent pointer-events-none" />
                  <span className="text-[10px] uppercase tracking-widest font-black text-zinc-600 relative z-20 mb-1">SILVER</span>
                  <span className="absolute -bottom-4 sm:-bottom-5 text-[110px] sm:text-[130px] font-black text-white/50 z-10 leading-none tracking-tighter">2</span>
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
                <div className={`w-full h-56 sm:h-64 bg-gradient-to-t from-orange-600 to-orange-400 flex flex-col items-center justify-end pb-6 border border-orange-400 text-white relative overflow-hidden ${isDownloading ? '' : 'shadow-xl shadow-orange-500/20'}`}>
                  {firstPlace.avatarUrl && (
                    <img
                      src={firstPlace.avatarUrl}
                      alt={firstPlace.name}
                      className="absolute inset-0 w-full h-full object-cover object-top brightness-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-600 from-20% via-orange-500/40 to-transparent pointer-events-none" />
                  <span className="text-[11px] uppercase tracking-widest font-black text-orange-100 relative z-20 mb-1">GOLD</span>
                  <span className="absolute -bottom-4 sm:-bottom-5 text-[110px] sm:text-[130px] font-black text-white/30 z-10 leading-none tracking-tighter">1</span>
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
                <div className={`w-full h-40 sm:h-48 bg-gradient-to-t from-orange-200 to-orange-50 flex flex-col items-center justify-end pb-4 border border-orange-200/80 relative overflow-hidden ${isDownloading ? '' : 'shadow-inner'}`}>
                  {thirdPlace.avatarUrl && (
                    <img
                      src={thirdPlace.avatarUrl}
                      alt={thirdPlace.name}
                      className="absolute inset-0 w-full h-full object-cover object-top brightness-105 saturate-50"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-200 from-20% via-orange-100/40 to-transparent pointer-events-none" />
                  <span className="text-[9px] uppercase tracking-widest font-black text-orange-700 relative z-20 mb-1">BRONZE</span>
                  <span className="absolute -bottom-4 sm:-bottom-5 text-[110px] sm:text-[130px] font-black text-white/50 z-10 leading-none tracking-tighter">3</span>
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
                      {!hideDiff && <th className="pb-2 text-center w-10">Diff</th>}
                      <th className="pb-2 text-right pr-1 w-12">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {standings.map((s) => (
                      <tr key={s.playerId ?? s.name} className={`transition-colors ${
                        s.rank === 1 ? 'bg-orange-50/90 hover:bg-orange-100/80' :
                        s.rank === 2 ? 'bg-orange-50/60 hover:bg-orange-100/50' :
                        s.rank === 3 ? 'bg-orange-50/30 hover:bg-orange-100/30' :
                        'hover:bg-zinc-50/50'
                      }`}>
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
                        {!hideDiff && (
                          <td className="py-2.5 text-center font-mono font-bold w-10">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                              (s.diff ?? 0) > 0
                                ? `bg-emerald-100 text-emerald-700 ${isDownloading ? '' : 'shadow-sm'}`
                                : (s.diff ?? 0) < 0
                                ? `bg-rose-100 text-rose-700 ${isDownloading ? '' : 'shadow-sm'}`
                                : 'text-zinc-500 bg-zinc-100'
                            }`}>
                              {(s.diff ?? 0) > 0 ? `+${s.diff}` : s.diff ?? 0}
                            </span>
                          </td>
                        )}
                        <td className="py-2.5 text-right pr-1 font-black text-[11px] text-orange-600 w-12 align-middle">
                          <div className="flex flex-col items-end justify-center leading-none">
                            <span>{s.totalPoints}</span>
                            {(s.byePoints || 0) > 0 && (
                              <span className="text-[7px] text-orange-400 font-bold uppercase mt-0.5">
                                +{s.byePoints} BYE
                              </span>
                            )}
                          </div>
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

      <div className="flex gap-2 w-full">
        <button
          type="button"
          onClick={handleDownloadImage}
          disabled={isDownloading || isDownloadingIG}
          className="flex-1 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-900/70 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
        >
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span>{isDownloading ? 'Exporting...' : 'Save Poster'}</span>
        </button>
        <button
          type="button"
          onClick={handleDownloadIGStory}
          disabled={isDownloading || isDownloadingIG}
          className="flex-1 py-3.5 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 disabled:opacity-70 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
        >
          {isDownloadingIG ? <Loader2 className="h-4 w-4 animate-spin" /> : <InstagramIcon className="h-4 w-4" />}
          <span>{isDownloadingIG ? 'Creating Story...' : 'IG Story'}</span>
        </button>
      </div>

      {/* Hidden IG Story Render Node (432x768, scales up to 1080x1920 with 2.5 pixelRatio) */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none opacity-0">
        <div
          id="ig-story-download-area"
          className="w-[432px] h-[768px] bg-white text-zinc-900 relative overflow-hidden bg-gradient-to-br from-white via-orange-50 to-zinc-50 flex flex-col font-sans"
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
          <div className={`absolute -top-40 -left-40 h-80 w-80 rounded-full bg-orange-500/20 pointer-events-none ${isDownloadingIG ? 'hidden' : 'blur-3xl'}`} />
          <div className={`absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-orange-600/10 pointer-events-none ${isDownloadingIG ? 'hidden' : 'blur-3xl'}`} />

          {/* IG Header */}
          <div className="flex flex-col items-center pt-8 pb-4 shrink-0 relative z-10 text-center space-y-2 border-b border-zinc-200/50 mx-6">
            <span className="text-[11px] font-black uppercase tracking-widest text-orange-600 block">
              COMMUNITRIX
            </span>
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-500 mt-1 ${isDownloadingIG ? '' : 'shadow-sm'}`}>
              <Trophy className="h-6 w-6" />
            </div>
            <h2 className={`text-[26px] leading-none font-black uppercase tracking-wider ${isDownloadingIG ? 'text-orange-600' : 'bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent'}`}>
              Final Leaderboard
            </h2>
            <span className="text-[11px] font-bold text-zinc-600 pt-1 block">{activityName} • {gameType} ({sport})</span>
          </div>

          {/* Combined Podiums & Table for IG Story */}
          <div className="flex-1 relative z-10 px-6 py-4 flex flex-col justify-center max-h-full">
            <div className={`rounded-2xl border border-zinc-200 bg-white/90 backdrop-blur-sm overflow-hidden flex flex-col shrink-0 ${isDownloadingIG ? '' : 'shadow-xl'}`}>
              <div className="p-2">
                <table className="w-full text-left font-sans text-zinc-900 border-collapse">
                  <thead>
                    <tr className="border-b-2 border-zinc-200 text-zinc-400 font-black uppercase text-[10px] tracking-widest">
                      <th className="pb-2 pl-2 w-8">#</th>
                      <th className="pb-2 w-auto">Player</th>
                      <th className="pb-2 text-center w-8">P</th>
                      <th className="pb-2 text-center w-12">W-L-T</th>
                      <th className="pb-2 text-right pr-2 w-10">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100/60">
                    {standings.slice(0, 10).map((s) => (
                      <tr key={s.playerId ?? s.name} className={`
                        ${s.rank === 1 ? 'bg-gradient-to-r from-orange-500 to-orange-400 text-white' : 
                          s.rank === 2 ? 'bg-gradient-to-r from-zinc-200 to-zinc-100 text-zinc-900' : 
                          s.rank === 3 ? 'bg-gradient-to-r from-orange-200 to-orange-100 text-zinc-900' : 
                          'bg-transparent'}
                        ${isDownloadingIG ? '' : (s.rank <= 3 ? 'shadow-sm' : '')}
                      `}>
                        {/* Rank */}
                        <td className={`py-1.5 pl-2 font-black text-[12px] align-middle ${s.rank === 1 ? 'text-white' : s.rank <= 3 ? 'text-zinc-700' : 'text-zinc-400'}`}>
                          {s.rank <= 3 ? (
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${isDownloadingIG ? '' : 'shadow-sm'} ${
                              s.rank === 1 ? 'bg-white text-orange-600' : 
                              s.rank === 2 ? 'bg-white text-zinc-600' : 
                              'bg-white text-orange-800'
                            }`}>
                              {s.rank}
                            </span>
                          ) : (
                            <span className="pl-1">{s.rank}</span>
                          )}
                        </td>
                        
                        {/* Player */}
                        <td className="py-1.5 align-middle">
                          <div className="flex items-center gap-2">
                            {s.rank <= 3 ? (
                              <div className={`relative h-7 w-7 rounded-full overflow-hidden shrink-0 bg-zinc-100 ${isDownloadingIG ? '' : 'shadow-sm'}`}>
                                {s.avatarUrl ? (
                                  <img src={s.avatarUrl} alt={s.name} className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                  <div className="flex items-center justify-center h-full w-full text-[9px] font-bold text-zinc-500 uppercase">
                                    {s.name.slice(0, 2)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="h-5 w-5 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[8px] font-bold text-zinc-500 uppercase shrink-0">
                                {s.name.slice(0, 2)}
                              </div>
                            )}
                            <p className={`font-black text-[12px] truncate max-w-[100px] ${s.rank === 1 ? 'text-white' : 'text-zinc-900'}`}>
                              {s.name.split(' ')[0]}
                            </p>
                          </div>
                        </td>

                        {/* Played */}
                        <td className={`py-1.5 text-center align-middle font-bold text-[11px] ${s.rank === 1 ? 'text-orange-50' : s.rank <= 3 ? 'text-zinc-600' : 'text-zinc-500'}`}>
                          {s.realMatchesPlayed !== undefined ? s.realMatchesPlayed : (s.wins + s.losses + s.ties)}
                        </td>

                        {/* W-L-T */}
                        <td className={`py-1.5 text-center align-middle font-mono font-black text-[10px] ${s.rank === 1 ? 'text-orange-50' : s.rank <= 3 ? 'text-zinc-700' : 'text-zinc-500'}`}>
                          {s.wins}-{s.losses}-{s.ties}
                        </td>

                        {/* Points */}
                        <td className={`py-1.5 text-right align-middle pr-2 font-black text-[13px] leading-none ${s.rank === 1 ? 'text-white' : s.rank <= 3 ? 'text-zinc-900' : 'text-orange-600'}`}>
                          <div className="flex flex-col items-end justify-center">
                            <span>{s.totalPoints}</span>
                            {(s.byePoints || 0) > 0 && (
                              <span className={`text-[7px] uppercase mt-0.5 ${s.rank === 1 ? 'text-orange-100' : s.rank <= 3 ? 'text-zinc-600' : 'text-orange-400'}`}>
                                +{s.byePoints} BYE
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Ranks 11-20 compact list */}
              {standings.length > 10 && (
                <div className="bg-zinc-50/80 border-t border-zinc-100 px-3 py-2.5 text-[9px] text-zinc-500 font-medium leading-relaxed">
                  <span className="font-black text-zinc-700 mr-1.5">Other Ranks:</span>
                  {standings.slice(10, 20).map(s => `#${s.rank} ${s.name.split(' ')[0]} (${s.totalPoints}pt)`).join(' • ')}
                  {standings.length > 20 && <span className="ml-1 font-bold text-zinc-400">...and {standings.length - 20} more</span>}
                </div>
              )}
              
              {/* Call to action */}
              <div className="bg-orange-50 px-3 py-2 text-center border-t border-orange-100/50">
                <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest">
                  View full standings at communitrix.id
                </span>
              </div>
            </div>
          </div>
          
          {/* IG Footer */}
          <div className="py-3 shrink-0 relative z-10 text-center bg-white/70 backdrop-blur-sm border-t border-zinc-200">
            <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase flex items-center justify-center gap-1.5">
              <Zap className="h-3 w-3 text-orange-500 animate-pulse" />
              Powered by communitrix.id
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
