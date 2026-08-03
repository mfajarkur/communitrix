'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Zap, Trash2, Users, Loader2, ChevronRight, Calendar } from 'lucide-react';
import { deletePersonalQuickMatchAction } from '@/server/actions/personal-match.actions';
import type { QuickMatchSummary } from '@/server/actions/personal-match.actions';

type Props = {
  matches: QuickMatchSummary[];
};

export default function QuickMatchHistory({ matches: initialMatches }: Props) {
  const [matches, setMatches] = useState(initialMatches);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'ended'>('open');
  const [sportFilter, setSportFilter] = useState<'ALL' | 'PADEL' | 'TENNIS'>('ALL');
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await deletePersonalQuickMatchAction(id);
      if (result.ok) {
        setMatches((prev) => prev.filter((m) => m.id !== id));
      }
      setConfirmingId(null);
    });
  };

  // Metrics for status filters
  const openMatchesCount = matches.filter((m) => m.status === 'OPEN').length;
  const endedMatchesCount = matches.filter((m) => m.status === 'ENDED').length;

  // Filter matches by status & sport
  const filteredMatches = matches.filter((m) => {
    if (statusFilter === 'open' && m.status !== 'OPEN') return false;
    if (statusFilter === 'ended' && m.status !== 'ENDED') return false;
    if (sportFilter !== 'ALL' && m.sport !== sportFilter) return false;
    return true;
  });

  // Sort by date descending (newest timestamp first)
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Group by Date String Header
  const groupedMatchesByDate: { dateLabel: string; items: QuickMatchSummary[] }[] = [];
  sortedMatches.forEach((m) => {
    const dateObj = new Date(m.created_at);
    let dateLabel = 'Unknown Date';
    if (!isNaN(dateObj.getTime())) {
      const isCurrentYear = dateObj.getFullYear() === new Date().getFullYear();
      dateLabel = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        ...(isCurrentYear ? {} : { year: 'numeric' }),
      });
    }

    let group = groupedMatchesByDate.find((g) => g.dateLabel === dateLabel);
    if (!group) {
      group = { dateLabel, items: [] };
      groupedMatchesByDate.push(group);
    }
    group.items.push(m);
  });

  return (
    <div className="space-y-6">
      {/* Filter Bar: Status Pills (Open / Ended) & Sport Tabs (All / Padel / Tennis) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        {/* Status Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'open'
                ? 'bg-orange-500 text-white shadow-xs font-extrabold'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200/60'
            }`}
          >
            Open • {openMatchesCount}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ended')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'ended'
                ? 'bg-orange-500 text-white shadow-xs font-extrabold'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200/60'
            }`}
          >
            Ended • {endedMatchesCount}
          </button>
        </div>

        {/* Sport Filter Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full border border-zinc-200/60">
          <button
            type="button"
            onClick={() => setSportFilter('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              sportFilter === 'ALL'
                ? 'bg-orange-500 text-white shadow-xs font-black'
                : 'text-zinc-500 hover:text-orange-600'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSportFilter('PADEL')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              sportFilter === 'PADEL'
                ? 'bg-orange-500 text-white shadow-xs font-black'
                : 'text-zinc-500 hover:text-orange-600'
            }`}
          >
            Padel
          </button>
          <button
            type="button"
            onClick={() => setSportFilter('TENNIS')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              sportFilter === 'TENNIS'
                ? 'bg-orange-500 text-white shadow-xs font-black'
                : 'text-zinc-500 hover:text-orange-600'
            }`}
          >
            Tennis
          </button>
        </div>
      </div>

      {/* Quick Matches List grouped by Date */}
      {matches.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 space-y-3 bg-zinc-50 rounded-2xl border border-zinc-100">
          <Zap className="h-10 w-10 mx-auto opacity-30 text-orange-500" />
          <p className="text-sm font-semibold text-zinc-700">No quick matches created yet.</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 space-y-2 bg-zinc-50 rounded-2xl border border-zinc-100">
          <Calendar className="h-8 w-8 mx-auto opacity-30 text-zinc-500" />
          <p className="text-sm font-semibold text-zinc-600">
            No {statusFilter} {sportFilter !== 'ALL' ? sportFilter.toLowerCase() : ''} quick matches found.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMatchesByDate.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              <h3 className="text-sm font-extrabold text-zinc-800 tracking-tight pt-1">
                {group.dateLabel}
              </h3>

              <div className="space-y-3">
                {group.items.map((m) => {
                  const dateObj = new Date(m.created_at);
                  const timeStr = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
                    : '6:00 PM';

                  const playerCount = m.players?.length ?? 0;
                  const isConfirming = confirmingId === m.id;
                  const isLoadingThis = loadingMatchId === m.id;
                  const isMatchEnded = m.status === 'ENDED';

                  return (
                    <Link
                      key={m.id}
                      href={`/activities/quick-match/${m.id}`}
                      onClick={() => setLoadingMatchId(m.id)}
                      className={`group rounded-2xl border transition-all flex flex-row items-stretch cursor-pointer select-none active:scale-[0.98] ${
                        isLoadingThis
                          ? 'border-orange-500 ring-2 ring-orange-400/40 bg-orange-50/40 shadow-inner'
                          : 'border-orange-100 bg-white hover:shadow-md hover:border-orange-300'
                      }`}
                    >
                      {/* Kotak Kiri: Jam dan Jenis Game (Shading Orange Transparan, abu-abu jika sudah Ended) */}
                      <div
                        className={`border-r p-3.5 sm:p-4 flex flex-col items-center justify-center min-w-[100px] sm:min-w-[125px] shrink-0 text-center transition-colors ${
                          isMatchEnded
                            ? 'bg-zinc-100 border-zinc-200'
                            : isLoadingThis
                            ? 'bg-orange-100/80 border-orange-200'
                            : 'bg-orange-50/80 border-orange-100/80'
                        }`}
                      >
                        <span className={`text-sm sm:text-base font-black tracking-tight ${isMatchEnded ? 'text-zinc-600' : 'text-orange-950'}`}>
                          {timeStr}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider uppercase mt-0.5 ${isMatchEnded ? 'text-zinc-500' : 'text-orange-600/90'}`}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              isMatchEnded ? 'bg-zinc-400' : 'bg-green-500 animate-pulse'
                            }`}
                          />
                          {m.game_type ? m.game_type.replace('_', ' ') : m.sport}
                        </span>
                      </div>

                      {/* Kotak Kanan: Nama Activity, Jumlah Players, Delete Action */}
                      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between min-w-0 bg-white">
                        <div>
                          <h4 className="text-base sm:text-lg font-black text-zinc-900 group-hover:text-orange-600 transition-colors truncate">
                            {m.activity_name}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between mt-2.5 text-xs text-zinc-500 font-semibold pt-1 border-t border-zinc-100/60">
                          <span className="flex items-center gap-1.5 truncate">
                            <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate">{playerCount} Players</span>
                          </span>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {isConfirming ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(m.id, e)}
                                  disabled={isPending}
                                  className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-60"
                                >
                                  {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setConfirmingId(null);
                                  }}
                                  disabled={isPending}
                                  className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmingId(m.id);
                                }}
                                className="p-1 rounded-lg text-zinc-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Delete Quick Match"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {isLoadingThis ? (
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-orange-600 animate-pulse">
                                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                                Opening...
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
