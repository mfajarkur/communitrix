import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Trophy, Calendar, Users, Crown } from 'lucide-react';
import { getQuickMatchById } from '@/server/actions/personal-match.actions';
import LeaderboardPrintSection from './leaderboard-print-section';

export default async function QuickMatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getQuickMatchById(id);
  if (!match) notFound();

  const playerName = (playerId: string) =>
    match.players.find((p) => p.id === playerId)?.name || 'Unknown';

  const teamLabel = (team: [string, string]) =>
    team.filter(Boolean).map(playerName).join(' / ');

  const rounds = Array.from(new Set(match.matches.map((m) => m.roundNumber))).sort((a, b) => a - b);

  const date = new Date(match.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <Link
        href="/communities"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to My Profile
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-zinc-950 p-6 text-white shadow-md space-y-2">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30">
          {match.game_type.replace('_', ' ')} · {match.sport}
        </span>
        <h1 className="text-2xl font-black tracking-tight">{match.activity_name}</h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/60 font-semibold pt-1">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> {date}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {match.players.length} players
          </span>
        </div>
      </div>

      <LeaderboardPrintSection
        activityName={match.activity_name}
        gameType={match.game_type}
        sport={match.sport}
        standings={match.standings}
      />

      {/* Leaderboard */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-orange-500" />
          <h2 className="text-sm font-black uppercase tracking-wide text-zinc-900">Leaderboard</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-black uppercase text-[10px] tracking-wider">
                <th className="py-3 pl-5 w-12">Rank</th>
                <th className="py-3">Player</th>
                <th className="py-3 text-center w-20">Matches</th>
                <th className="py-3 text-center w-24">W-L-T</th>
                <th className="py-3 text-center w-16">Diff</th>
                <th className="py-3 text-right pr-5 w-20">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {match.standings.map((s) => (
                <tr key={s.playerId} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 pl-5 font-black text-zinc-900">
                    {s.rank === 1 ? (
                      <Crown className="h-4 w-4 text-amber-500 inline" />
                    ) : (
                      `#${s.rank}`
                    )}
                  </td>
                  <td className="py-3 font-extrabold text-zinc-900">{s.name}</td>
                  <td className="py-3 text-center font-bold text-zinc-700">
                    {s.realMatchesPlayed ?? s.wins + s.losses + s.ties}
                  </td>
                  <td className="py-3 text-center font-mono font-black text-zinc-700">
                    {s.wins}-{s.losses}-{s.ties}
                  </td>
                  <td className="py-3 text-center font-mono font-bold">
                    <span
                      className={
                        (s.diff ?? 0) > 0
                          ? 'text-emerald-600'
                          : (s.diff ?? 0) < 0
                          ? 'text-rose-600'
                          : 'text-zinc-500'
                      }
                    >
                      {(s.diff ?? 0) > 0 ? `+${s.diff}` : s.diff ?? 0}
                    </span>
                  </td>
                  <td className="py-3 text-right pr-5 font-black text-zinc-900">{s.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Round-by-round match history */}
      <div className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-900">Match History</h2>
        {rounds.map((roundNumber) => (
          <div key={roundNumber} className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-600">Round {roundNumber}</h3>
            </div>
            <div className="divide-y divide-zinc-100">
              {match.matches
                .filter((m) => m.roundNumber === roundNumber)
                .sort((a, b) => a.courtNumber - b.courtNumber)
                .map((m) => {
                  const aWins = m.scoreA !== null && m.scoreB !== null && m.scoreA > m.scoreB;
                  const bWins = m.scoreA !== null && m.scoreB !== null && m.scoreB > m.scoreA;
                  return (
                    <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 shrink-0">
                        Court {m.courtNumber}
                      </span>
                      <div className="flex items-center gap-3 flex-1 justify-center min-w-0">
                        <span className={`text-xs font-bold truncate ${aWins ? 'text-emerald-600' : 'text-zinc-700'}`}>
                          {teamLabel(m.teamA)}
                        </span>
                        <span className="text-xs font-mono font-black text-zinc-900 shrink-0">
                          {m.scoreA ?? '-'} : {m.scoreB ?? '-'}
                        </span>
                        <span className={`text-xs font-bold truncate ${bWins ? 'text-emerald-600' : 'text-zinc-700'}`}>
                          {teamLabel(m.teamB)}
                        </span>
                      </div>
                      {!m.isCompleted && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 shrink-0">
                          Incomplete
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
