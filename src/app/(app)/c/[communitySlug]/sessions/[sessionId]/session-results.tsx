import Link from 'next/link';
import { ArrowLeft, Trophy, Users, Crown } from 'lucide-react';
import { getDisplayName, getAvatarUrl } from '@/lib/utils/profile';
import LeaderboardPrintSection from '@/app/(app)/activities/quick-match/[id]/leaderboard-print-section';
import type { PosterStanding } from '@/components/leaderboard-poster';
import ScoreButtonPair from '@/components/session-live/score-button-pair';

interface MatchPlayer {
  profile_id: string;
  team: 'A' | 'B';
  slot: number;
  elo_before?: number;
  elo_delta?: number;
  elo_after?: number;
  elo_profile_id?: string;
  profile: { full_name?: string | null; display_name?: string | null; avatar_url?: string | null };
  elo_profile?: { full_name?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
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
  sessionCp: { profile_id: string; points_awarded: number }[];
};

// Read-only recap for a finished community session — no score entry, no round generation,
// no realtime subscription. Structurally mirrors the Personal Quick Match recap
// (communities/quick-match/[id]/page.tsx), just sourced from community DB tables and
// still reflecting this session's ELO-affecting results (ELO itself was already applied
// live, per match, while the session was active).
export default function SessionResults({ communitySlug, session, rounds, matches, standings }: Props) {
  const renderTeam = (players: MatchPlayer[], side: 'A' | 'B', isWinner: boolean) => (
    <div className={`flex-1 space-y-1.5 flex flex-col ${side === 'A' ? 'items-start' : 'items-end'}`}>
      {players.map((mp) => {
        const isSubbed = mp.elo_profile_id && mp.elo_profile_id !== mp.profile_id;
        const actualProfile = isSubbed ? mp.elo_profile! : mp.profile;
        
        return (
          <div
            key={mp.profile_id}
            className={`flex items-center gap-1.5 min-w-0 ${side === 'B' ? 'flex-row-reverse' : ''}`}
          >
            <div className="relative shrink-0">
              <img
                src={getAvatarUrl({ id: isSubbed ? mp.elo_profile_id! : mp.profile_id, avatar_url: actualProfile.avatar_url, full_name: actualProfile.full_name })}
                alt=""
                className="h-7 w-7 rounded-full object-cover border border-zinc-200"
              />
              {isSubbed && (
                <div className="absolute -bottom-1 -right-1 bg-zinc-800 text-white text-[8px] font-bold px-1 rounded shadow-sm">
                  SUB
                </div>
              )}
            </div>
            <div className={`flex items-center gap-1.5 ${side === 'B' ? 'flex-row-reverse' : ''}`}>
              <span className={`font-bold text-xs sm:text-sm md:text-base truncate max-w-[90px] sm:max-w-[130px] md:max-w-[160px] ${isWinner ? 'text-orange-600' : 'text-zinc-700'}`}>
                {getDisplayName(actualProfile)}
              </span>
              {mp.elo_delta !== undefined && mp.elo_delta !== null && (
                <span className={`text-[10px] font-black ${mp.elo_delta > 0 ? 'text-emerald-500' : mp.elo_delta < 0 ? 'text-rose-500' : 'text-zinc-400'}`}>
                  {mp.elo_delta > 0 ? `+${mp.elo_delta}` : mp.elo_delta}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
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
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">{session.name}</h1>
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
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Final Leaderboard</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-black uppercase text-[10px] tracking-wider">
                <th className="py-2 pl-4 w-10">Rank</th>
                <th className="py-2 w-24">Player</th>
                <th className="py-2 text-center px-1 w-10">M</th>
                <th className="py-2 text-center px-1 w-20">W-L-T</th>
                <th className="py-2 text-center px-1 w-10">D</th>
                <th className="py-2 text-right pr-4 w-14">P</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {standings.map((s) => (
                <tr key={s.playerId} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-2 pl-4 font-black text-zinc-900">
                    {s.rank === 1 ? <Crown className="h-4 w-4 text-amber-500 inline" /> : `#${s.rank}`}
                  </td>
                  <td className="py-2 font-extrabold text-zinc-900">
                    <span className="block max-w-[70px] truncate">{s.name}</span>
                  </td>
                  <td className="py-2 text-center px-1 font-bold text-zinc-700">
                    {s.realMatchesPlayed ?? s.wins + s.losses + s.ties}
                  </td>
                  <td className="py-2 text-center px-1 font-mono font-black text-zinc-700">
                    {s.wins}-{s.losses}-{s.ties}
                  </td>
                  <td className="py-2 text-center px-1 font-mono font-bold">
                    <span
                      className={
                        (s.diff ?? 0) > 0 ? 'text-emerald-600' : (s.diff ?? 0) < 0 ? 'text-rose-600' : 'text-zinc-500'
                      }
                    >
                      {(s.diff ?? 0) > 0 ? `+${s.diff}` : s.diff ?? 0}
                    </span>
                  </td>
                  <td className="py-2 text-right pr-4 font-black text-zinc-900 whitespace-nowrap">
                    {s.totalPoints}
                    {(s.byePoints ?? 0) > 0 && (
                      <span
                        title={
                          s.byeIsPlaceholder
                            ? `Includes ${s.byePoints} placeholder point${s.byePoints === 1 ? '' : 's'} for a round not yet played (no match history yet)`
                            : `Includes ${s.byePoints} bye point${s.byePoints === 1 ? '' : 's'} (estimated from this player's average, for a round they sat out)`
                        }
                        className={`text-[9px] font-bold ml-1 px-1 py-0.5 rounded uppercase tracking-wide ${
                          s.byeIsPlaceholder ? 'text-zinc-500 bg-zinc-100' : 'text-amber-700 bg-amber-100'
                        }`}
                      >
                        {s.byePoints} bye
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-center text-[9px] text-zinc-400 font-medium py-2 bg-zinc-50 border-t border-zinc-100">
          M = Matches · W-L-T = Wins-Losses-Ties · D = Diff · P = Points (bye points already included, badge shows how many)
        </div>
      </div>

      {/* Round-by-round match history */}
      <div className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Match History</h2>
        {rounds.map((round) => (
          <div key={round.id} className="space-y-3">
            <h3 className="text-sm font-extrabold text-zinc-800 tracking-tight px-1">Round {round.round_number}</h3>
            <div className="space-y-4">
              {matches
                .filter((m) => m.round_number === round.round_number)
                .sort((a, b) => a.court_number - b.court_number)
                .map((m) => {
                  const teamA = m.match_players.filter((mp) => mp.team === 'A');
                  const teamB = m.match_players.filter((mp) => mp.team === 'B');
                  const isCompleted = m.status === 'COMPLETED';
                  return (
                    <div
                      key={m.id}
                      className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                        <span className="font-bold text-base text-[#111827]">Court {m.court_number}</span>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500">
                          {isCompleted ? 'Completed' : m.status}
                        </span>
                      </div>
                      <div className="relative px-4 pt-7 pb-4">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
                          <ScoreButtonPair
                            scoreA={m.team_a_score}
                            scoreB={m.team_b_score}
                            isCompleted
                            winnerSide={m.winner_side}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {renderTeam(teamA, 'A', isCompleted && m.winner_side === 'A')}
                          <span className="shrink-0 h-6 w-6 rounded-full bg-white border border-zinc-200 text-zinc-400 text-[9px] font-bold flex items-center justify-center uppercase">
                            vs
                          </span>
                          {renderTeam(teamB, 'B', isCompleted && m.winner_side === 'B')}
                        </div>
                      </div>
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

      {/* Recap Elo & CP Changes */}
      <div className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Session Rating & CP Recap</h2>
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
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
              <tbody className="divide-y divide-zinc-100">
                {standings.map((s) => {
                  const cpEntry = sessionCp.find((c) => c.profile_id === s.playerId);
                  const pointsAwarded = cpEntry?.points_awarded ?? 0;

                  // Find all matches this player participated in (either original or sub)
                  const playerMatches = matches
                    .filter((m) => m.status === 'COMPLETED')
                    .map((m) => {
                      const mp = m.match_players.find((p) => p.profile_id === s.playerId || p.elo_profile_id === s.playerId);
                      return { match: m, mp };
                    })
                    .filter((entry) => entry.mp);

                  playerMatches.sort((a, b) => {
                    if (a.match.round_number !== b.match.round_number) return a.match.round_number - b.match.round_number;
                    return a.match.court_number - b.match.court_number;
                  });

                  let eloBefore = null;
                  let eloAfter = null;
                  let netEloChange = 0;

                  if (playerMatches.length > 0) {
                    // Elo before their FIRST match
                    const firstMp = playerMatches[0].mp!;
                    eloBefore = firstMp.elo_before;

                    // Elo after their LAST match
                    const lastMp = playerMatches[playerMatches.length - 1].mp!;
                    eloAfter = lastMp.elo_after;

                    // Sum of all deltas
                    netEloChange = playerMatches.reduce((acc, curr) => acc + (curr.mp!.elo_delta || 0), 0);
                  }

                  // Count how many matches they played as a SUBSTITUTE
                  const subCount = playerMatches.filter(pm => pm.mp!.elo_profile_id === s.playerId && pm.mp!.profile_id !== s.playerId).length;

                  // Count how many matches they were SUBBED OUT (original player, but didn't play)
                  const subbedOutCount = playerMatches.filter(pm => pm.mp!.profile_id === s.playerId && pm.mp!.elo_profile_id && pm.mp!.elo_profile_id !== s.playerId).length;

                  return (
                    <tr key={s.playerId} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <img
                            src={getAvatarUrl({ id: s.playerId, avatar_url: (s as any).avatarUrl, full_name: s.name })}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover border border-zinc-200 shrink-0"
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 truncate max-w-[120px]">{s.name}</span>
                            {subCount > 0 && <span className="text-[9px] text-zinc-400 font-medium">Subbed in {subCount}x</span>}
                            {subbedOutCount > 0 && <span className="text-[9px] text-rose-400 font-medium">Missed {subbedOutCount}x (Penalty)</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center align-middle font-mono font-bold">
                        {eloBefore !== null ? (
                          <span className={netEloChange > 0 ? 'text-emerald-500' : netEloChange < 0 ? 'text-rose-500' : 'text-zinc-400'}>
                            {netEloChange > 0 ? `+${netEloChange.toFixed(1)}` : netEloChange.toFixed(1)}
                          </span>
                        ) : <span className="text-zinc-300">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center align-middle font-mono font-medium text-zinc-500 text-xs">
                        {eloBefore !== null ? eloBefore.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center align-middle font-mono font-extrabold text-zinc-700 text-xs">
                        {eloAfter !== null ? eloAfter.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center align-middle font-mono font-black">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-md text-xs border ${
                          pointsAwarded > 0 ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                        }`}>
                          {pointsAwarded > 0 ? `+${pointsAwarded}` : pointsAwarded}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
