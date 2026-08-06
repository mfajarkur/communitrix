'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { getAvatarUrl } from '@/lib/utils/profile';

type RecapItem = {
  playerId: string;
  name: string;
  avatarUrl?: string;
  pointsAwarded: number;
  eloBefore: number | null;
  eloAfter: number | null;
  netEloChange: number;
  subCount: number;
  subbedOutCount: number;
};

type Props = {
  recapData: RecapItem[];
};

export default function RecapPrintSection({ recapData }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { toBlob } = await import('html-to-image');
      const node = document.getElementById('recap-download-area');
      if (!node) {
        setIsDownloading(false);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const blob = await toBlob(node, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        style: {
          margin: '0',
          borderRadius: '0',
          boxShadow: 'none',
        },
      });

      if (!blob) throw new Error('Failed to generate image');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-recap-${new Date().getTime()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download recap image', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Session Rating & CP Recap</h2>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
        >
          {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          <span>{isDownloading ? 'Saving...' : 'Save Image'}</span>
        </button>
      </div>

      <div id="recap-download-area" className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm p-4 sm:p-0 sm:border-0 sm:shadow-none sm:bg-transparent">
        <div className="sm:rounded-2xl sm:border sm:border-zinc-200 sm:bg-white sm:overflow-hidden sm:shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="py-3 px-4 font-extrabold text-zinc-500 uppercase tracking-wider text-[10px]">Player</th>
                  <th className="py-3 px-4 text-center font-extrabold text-zinc-500 uppercase tracking-wider text-[10px]">Net Elo</th>
                  <th className="py-3 px-4 text-center font-extrabold text-zinc-500 uppercase tracking-wider text-[10px]">Before</th>
                  <th className="py-3 px-4 text-center font-extrabold text-zinc-500 uppercase tracking-wider text-[10px]">After</th>
                  <th className="py-3 px-4 text-center font-extrabold text-zinc-500 uppercase tracking-wider text-[10px]">Earned CP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {recapData.map((r) => (
                  <tr key={r.playerId} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <img
                          src={getAvatarUrl({ id: r.playerId, avatar_url: r.avatarUrl, full_name: r.name })}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover border border-zinc-200 shrink-0"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 truncate max-w-[120px]">{r.name}</span>
                          {r.subCount > 0 && <span className="text-[9px] text-zinc-400 font-medium">Subbed in {r.subCount}x</span>}
                          {r.subbedOutCount > 0 && <span className="text-[9px] text-rose-400 font-medium">Missed {r.subbedOutCount}x (Penalty)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center align-middle font-mono font-bold">
                      {r.eloBefore !== null ? (
                        <span className={r.netEloChange > 0 ? 'text-emerald-500' : r.netEloChange < 0 ? 'text-rose-500' : 'text-zinc-400'}>
                          {r.netEloChange > 0 ? `+${r.netEloChange.toFixed(1)}` : r.netEloChange.toFixed(1)}
                        </span>
                      ) : <span className="text-zinc-300">-</span>}
                    </td>
                    <td className="py-3 px-4 text-center align-middle font-mono font-medium text-zinc-500 text-xs">
                      {r.eloBefore !== null ? r.eloBefore.toFixed(1) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center align-middle font-mono font-extrabold text-zinc-700 text-xs">
                      {r.eloAfter !== null ? r.eloAfter.toFixed(1) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center align-middle font-mono font-black">
                      <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-md text-xs border ${
                        r.pointsAwarded > 0 ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                      }`}>
                        {r.pointsAwarded > 0 ? `+${r.pointsAwarded}` : r.pointsAwarded}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
