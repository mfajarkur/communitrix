'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, ChevronRight, Users } from 'lucide-react';
import type { MySessionSummary } from '@/server/actions/session.actions';

type Props = {
  sessions: MySessionSummary[];
};

export default function MySessionsList({ sessions }: Props) {
  const [statusFilter, setStatusFilter] = useState<'live' | 'ended'>('live');
  const [sportFilter, setSportFilter] = useState<'ALL' | 'PADEL' | 'TENNIS'>('ALL');

  const liveCount = sessions.filter((s) => s.isLive).length;
  const endedCount = sessions.filter((s) => !s.isLive).length;

  const filteredSessions = sessions.filter((s) => {
    if (statusFilter === 'live' && !s.isLive) return false;
    if (statusFilter === 'ended' && s.isLive) return false;
    if (sportFilter !== 'ALL' && s.sport !== sportFilter) return false;
    return true;
  });

  const sortedSessions = [...filteredSessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const groupedByDate: { dateLabel: string; items: MySessionSummary[] }[] = [];
  sortedSessions.forEach((s) => {
    const dateObj = new Date(s.date);
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
    let group = groupedByDate.find((g) => g.dateLabel === dateLabel);
    if (!group) {
      group = { dateLabel, items: [] };
      groupedByDate.push(group);
    }
    group.items.push(s);
  });

  return (
    <div className="space-y-6">
      {/* Filter Bar: Status Pills (Live / Ended) & Sport Tabs (All / Padel / Tennis) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('live')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'live'
                ? 'bg-orange-500 text-white shadow-xs font-extrabold'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200/60'
            }`}
          >
            Live • {liveCount}
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
            Ended • {endedCount}
          </button>
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full border border-zinc-200/60">
          {(['ALL', 'PADEL', 'TENNIS'] as const).map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => setSportFilter(sport)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                sportFilter === sport ? 'bg-orange-500 text-white shadow-xs font-black' : 'text-zinc-500 hover:text-orange-600'
              }`}
            >
              {sport === 'ALL' ? 'All' : sport === 'PADEL' ? 'Padel' : 'Tennis'}
            </button>
          ))}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 space-y-3 bg-zinc-50 rounded-2xl border border-zinc-100">
          <Calendar className="h-10 w-10 mx-auto opacity-30 text-orange-500" />
          <p className="text-sm font-semibold text-zinc-700">No sessions yet.</p>
          <p className="text-xs text-zinc-400">Sessions you play in any community will show up here.</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 space-y-2 bg-zinc-50 rounded-2xl border border-zinc-100">
          <Calendar className="h-8 w-8 mx-auto opacity-30 text-zinc-500" />
          <p className="text-sm font-semibold text-zinc-600">
            No {statusFilter} {sportFilter !== 'ALL' ? sportFilter.toLowerCase() : ''} sessions found.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              <h3 className="text-sm font-extrabold text-zinc-800 tracking-tight pt-1">
                {group.dateLabel}
              </h3>

              <div className="space-y-3">
                {group.items.map((s) => {
                  const dateObj = new Date(s.date);
                  const timeStr = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
                    : '';

                  return (
                    <Link
                      key={s.id}
                      href={`/c/${s.communitySlug}/sessions/${s.id}`}
                      className="group rounded-2xl border transition-all flex flex-row items-stretch cursor-pointer select-none active:scale-[0.98] border-orange-100 bg-white hover:shadow-md hover:border-orange-300"
                    >
                      <div
                        className={`border-r p-3.5 sm:p-4 flex flex-col items-center justify-center min-w-[100px] sm:min-w-[125px] shrink-0 text-center transition-colors ${
                          s.isLive ? 'bg-orange-50/80 border-orange-100/80' : 'bg-zinc-100 border-zinc-200'
                        }`}
                      >
                        <span className={`text-sm sm:text-base font-black tracking-tight ${s.isLive ? 'text-orange-950' : 'text-zinc-600'}`}>
                          {timeStr}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider uppercase mt-0.5 ${
                            s.isLive ? 'text-orange-600/90' : 'text-zinc-500'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.isLive ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
                          {s.sport}
                        </span>
                      </div>

                      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between min-w-0 bg-white">
                        <div>
                          <h4 className="text-base sm:text-lg font-black text-zinc-900 group-hover:text-orange-600 transition-colors truncate">
                            {s.name}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between mt-2.5 text-xs text-zinc-500 font-semibold pt-1 border-t border-zinc-100/60">
                          <span className="flex items-center gap-1.5 truncate">
                            <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate">{s.communityName}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
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
