import Link from 'next/link';
import { ChevronRight, Calendar } from 'lucide-react';
import type { MySessionSummary } from '@/server/actions/session.actions';

export default function MySessionsList({ sessions }: { sessions: MySessionSummary[] }) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400 space-y-3 bg-zinc-50 rounded-2xl border border-zinc-100">
        <Calendar className="h-10 w-10 mx-auto opacity-30 text-orange-500" />
        <p className="text-sm font-semibold text-zinc-700">No sessions yet.</p>
        <p className="text-xs text-zinc-400">Sessions you play in any community will show up here.</p>
      </div>
    );
  }

  const live = sessions.filter((s) => s.isLive);
  const ended = sessions.filter((s) => !s.isLive);

  return (
    <div className="space-y-6">
      {live.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1">Live</h3>
          <div className="space-y-2">
            {live.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        </div>
      )}

      {ended.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1">Ended</h3>
          <div className="space-y-2">
            {ended.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: MySessionSummary }) {
  const dateObj = new Date(session.date);
  const dateLabel = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <Link
      href={`/c/${session.communitySlug}/sessions/${session.id}`}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm hover:border-orange-200 hover:shadow-md transition-all"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {session.isLive && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />}
          <h4 className="text-sm font-black text-zinc-900 truncate group-hover:text-orange-600 transition-colors">
            {session.name}
          </h4>
        </div>
        <p className="text-[11px] text-zinc-500 font-semibold truncate">
          {session.communityName} · {session.sport} · {dateLabel}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  );
}
