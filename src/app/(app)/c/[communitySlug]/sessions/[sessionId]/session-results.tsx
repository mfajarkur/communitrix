import Link from 'next/link';
import { ArrowLeft, Trophy, Users, Crown } from 'lucide-react';
import { getDisplayName } from '@/lib/utils/profile';
import LeaderboardPrintSection from '@/app/(app)/communities/quick-match/[id]/leaderboard-print-section';
import type { PosterStanding } from '@/components/leaderboard-poster';

interface MatchPlayer {
  profile_id: string;
  team: 'A' | 'B';
  slot: number;
  profile: { full_name?: string | null; display_name?: string | null };
}

interface Match {
  id: string;
  court_number: number;
  round_number: number;
  team_a_score: number | null;
  team_b_score: number | null;
  status: string;
  winner_side: 'A' | 'B' | null;
  match_players: MatchPlayer[];
}

interface Round {
  id: string;
  round_number: number;
  status: string;
}

type Props = {
  communitySlug: string;
  session: { name: string; sport: string; format: string; status: string };
  rounds: Round[];
  matches: Match[];
  standings: PosterStanding[];
};

// Read-only recap for a finished community session — no score entry, no round generation,
// no realtime subscription. Structurally mirrors the Personal Quick Match recap
// (communities/quick-match/[id]/page.tsx), just sourced from community DB tables and
// still reflecting this session's ELO-affecting results (ELO itself was already applied
// live, per match, while the session was active).
export default function SessionResults({ communitySlug, session, rounds, matches, standings }: Props) {
  const teamLabel = (players: MatchPlayer[]) =>
    players.map((mp) => getDisplayName(mp.profile)).join(' / ');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <Link
        href={`/c/${communitySlug}`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Community
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-zinc-950 p-6 text-white shadow-md space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30">
            {session.format} · {session.sport}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-white/10 text-white/60 border border-white/10">
            {session.status === 'CANCELLED' ? 'Cancelled' : 'Ended'}
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight">{session.name}</h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/60 font-semibold pt-1">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {standings.length} players
          </span>
          <span>ELO applied live, per completed match</span>
        </div>
      </div>

      <LeaderboardPrintSection
        activityName={session.name}
        gameType={session.format}
        sport={session.sport}
        standings={standings}
      />

      {/* Leaderboard */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-orange-500" />
          <h2 className="text-sm font-black uppercase tracking-wide text-zinc-900">Final Leaderboard</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-black uppercase text-[10px] tracking-wider">
                <th className="py-3 pl-5 w-12">Rank</th>
                <th className="py-3 w-28">Player</th>
                <th className="py-3 text-center w-20">Matches</th>
                <th className="py-3 text-center w-24">W-L-T</th>
                <th className="py-3 text-center w-16">Diff</th>
                <th className="py-3 text-right pr-5 w-20">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {standings.map((s) => (
                <tr key={s.playerId} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 pl-5 font-black text-zinc-900">
                    {s.rank === 1 ? <Crown className="h-4 w-4 text-amber-500 inline" /> : `#${s.rank}`}
                  </td>
                  <td className="py-3 font-extrabold text-zinc-900">
                    <span className="block max-w-[90px] truncate">{s.name}</span>
                  </td>
                  <td className="py-3 text-center font-bold text-zinc-700">
                    {s.realMatchesPlayed ?? s.wins + s.losses + s.ties}
                  </td>
                  <td className="py-3 text-center font-mono font-black text-zinc-700">
                    {s.wins}-{s.losses}-{s.ties}
                  </td>
                  <td className="py-3 text-center font-mono font-bold">
                    <span
                      className={
                        (s.diff ?? 0) > 0 ? 'text-emerald-600' : (s.diff ?? 0) < 0 ? 'text-rose-600' : 'text-zinc-500'
                      }
                    >
                      {(s.diff ?? 0) > 0 ? `+${s.diff}` : s.diff ?? 0}
                    </span>
                  </td>
                  <td className="py-3 text-right pr-5 font-black text-zinc-900 whitespace-nowrap">
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
      </div>

      {/* Round-by-round match history */}
      <div className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-900">Match History</h2>
        {rounds.map((round) => (
          <div key={round.id} className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-600">Round {round.round_number}</h3>
            </div>
            <div className="divide-y divide-zinc-100">
              {matches
                .filter((m) => m.round_number === round.round_number)
                .sort((a, b) => a.court_number - b.court_number)
                .map((m) => {
                  const teamA = m.match_players.filter((mp) => mp.team === 'A');
                  const teamB = m.match_players.filter((mp) => mp.team === 'B');
                  const aWins = m.winner_side === 'A';
                  const bWins = m.winner_side === 'B';
                  return (
                    <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 shrink-0">
                        Court {m.court_number}
                      </span>
                      <div className="flex items-center gap-3 flex-1 justify-center min-w-0">
                        <span className={`text-xs font-bold truncate ${aWins ? 'text-emerald-600' : 'text-zinc-700'}`}>
                          {teamLabel(teamA)}
                        </span>
                        <span className="text-xs font-mono font-black text-zinc-900 shrink-0">
                          {m.team_a_score ?? '-'} : {m.team_b_score ?? '-'}
                        </span>
                        <span className={`text-xs font-bold truncate ${bWins ? 'text-emerald-600' : 'text-zinc-700'}`}>
                          {teamLabel(teamB)}
                        </span>
                      </div>
                      {m.status !== 'COMPLETED' && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 shrink-0">
                          {m.status}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
        {rounds.length === 0 && (
          <div className="text-center py-10 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50 text-zinc-400 text-sm">
            No rounds were played in this session.
          </div>
        )}
      </div>
    </div>
  );
}
