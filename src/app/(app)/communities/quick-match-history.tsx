'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Zap, Trash2, Trophy, Users, Loader2 } from 'lucide-react';
import { deletePersonalQuickMatchAction } from '@/server/actions/personal-match.actions';
import type { QuickMatchSummary } from '@/server/actions/personal-match.actions';

type Props = {
  matches: QuickMatchSummary[];
};

export default function QuickMatchHistory({ matches: initialMatches }: Props) {
  const [matches, setMatches] = useState(initialMatches);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deletePersonalQuickMatchAction(id);
      if (result.ok) {
        setMatches((prev) => prev.filter((m) => m.id !== id));
      }
      setConfirmingId(null);
    });
  };

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 mb-3">
          <Zap className="h-5 w-5" />
        </div>
        <p className="text-sm font-bold text-zinc-700">No quick matches yet</p>
        <p className="text-xs text-zinc-500 mt-0.5">Start one above — results will show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((m) => {
        const winner = m.standings?.[0];
        const playerCount = m.players?.length ?? 0;
        const date = new Date(m.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const isConfirming = confirmingId === m.id;

        return (
          <div
            key={m.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center justify-between gap-3 shadow-sm"
          >
            <Link href={`/communities/quick-match/${m.id}`} className="min-w-0 flex-1 group/link">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-black text-zinc-900 truncate group-hover/link:text-orange-600 transition-colors">
                  {m.activity_name}
                </p>
                {m.status === 'OPEN' ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-green-50 text-green-600 border border-green-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live · Ongoing
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-500 border border-zinc-200">
                    Ended
                  </span>
                )}
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-200">
                  {m.game_type.replace('_', ' ')} · {m.sport}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-500 font-semibold">
                <span>{date}</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {playerCount} players
                </span>
                {winner && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Trophy className="h-3 w-3" />
                    {m.status === 'OPEN' ? 'Leading: ' : ''}
                    {winner.name} · {winner.totalPoints} pts
                  </span>
                )}
              </div>
            </Link>

            {isConfirming ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={isPending}
                  className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  disabled={isPending}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(m.id)}
                className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                aria-label="Delete match"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
