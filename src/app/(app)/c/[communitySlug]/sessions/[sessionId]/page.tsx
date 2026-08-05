import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import LiveBoardWrapper from './live-board-wrapper';
import SessionResults from './session-results';
import SessionHostsBar from './session-hosts-bar';
import { getDisplayName } from '@/lib/utils/profile';

export default async function SessionLiveBoardPage({
  params,
}: {
  params: Promise<{ communitySlug: string; sessionId: string }>;
}) {
  const { communitySlug, sessionId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // 1. Fetch Session Info
  const { data: session, error: sErr } = await supabase
    .from('sessions')
    .select('id, session_name, sport, format, status, court_count, rounds_planned, community_id, scoring_type, points_mode, max_score_target, bye_scoring_method')
    .eq('id', sessionId)
    .single();

  if (sErr || !session) {
    notFound();
  }

  // 2. Fetch User Membership Role & Session Hosts
  const { data: membership } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', session.community_id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  const { data: sessionHostsData } = await supabase
    .from('session_hosts')
    .select('profile_id, profile:profiles!session_hosts_profile_id_fkey(id, full_name, display_name, avatar_url)')
    .eq('session_id', sessionId);

  const { data: communityMembersData } = await supabase
    .from('community_members')
    .select('profile_id, profile:profiles!community_members_profile_id_fkey(id, full_name, display_name, avatar_url)')
    .eq('community_id', session.community_id)
    .eq('is_active', true);

  const hostProfiles: any[] = (sessionHostsData || []).map((h: any) => h.profile).filter(Boolean);
  const communityMemberProfiles: any[] = (communityMembersData || []).map((cm: any) => cm.profile).filter(Boolean);

  const hostProfileIds = hostProfiles.map((h: any) => h.id);
  const isHostOrAdmin = membership?.role === 'ADMIN' || hostProfileIds.includes(profile.id);

  // 3. Fetch ALL rounds (not just the latest) so both the round carousel (active sessions)
  // and the final results recap (ended sessions) can show full match history.
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, round_number, status')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: true });

  const allRounds = rounds || [];

  // 4. Fetch ALL matches across every round
  const { data: matchesData } = await supabase
    .from('matches')
    .select(`
      id,
      court_number,
      round_number,
      round_id,
      team_a_score,
      team_b_score,
      status,
      winner_side,
      formula_version,
      match_players (
        profile_id,
        team,
        slot,
        elo_before,
        elo_delta,
        elo_after,
        k_factor,
        elo_profile_id,
        profile:profiles!match_players_profile_id_fkey (
          full_name,
          display_name,
          avatar_url
        ),
        elo_profile:profiles!match_players_elo_profile_id_fkey (
          full_name,
          display_name,
          avatar_url
        )
      )
    `)
    .eq('session_id', sessionId)
    .order('round_number', { ascending: true })
    .order('court_number', { ascending: true });

  // Supabase infers the joined `profile` relation as an array even though it's a single row
  // at runtime (same pre-existing quirk worked around loosely elsewhere in this codebase) —
  // typed `any[]` here rather than fighting the inference for a read-only display list.
  const allMatches: any[] = matchesData || [];

  // 5. Fetch session players who actually participate in standings: ACTIVE + WITHDRAWN (a
  // player who played real, scored matches and then had to leave still keeps their results in
  // the final leaderboard/print poster) — only NO_SHOW is excluded, since they never played.
  const { data: sessionPlayers } = await supabase
    .from('session_players')
    .select(`
      profile_id,
      status,
      session_points_for,
      session_points_against,
      session_wins,
      session_losses,
      session_draws,
      profile:profiles!session_players_profile_id_fkey (
        full_name,
        display_name,
        avatar_url
      )
    `)
    .eq('session_id', sessionId)
    .in('status', ['ACTIVE', 'WITHDRAWN']);

  const participatingPlayers = sessionPlayers || [];
  // The Live Board's sit-out banner should only ever consider currently-ACTIVE players —
  // someone who withdrew isn't "sitting out" this round, they've left the session.
  const activePlayers = participatingPlayers.filter((p: any) => p.status === 'ACTIVE');

  // 6. Standings — same shape LeaderboardPoster/LeaderboardPrintSection expect (PosterStanding),
  // computed once here so both the live board and the results recap share identical numbers.
  //
  // Bye points: a player behind on matches played (because they sat out a round while others
  // played) gets a placeholder score per missed round — same formula Quick Match already
  // computes locally (see wizard-form.tsx's `standings` useMemo / docs/bye-point-brief.md) —
  // so their leaderboard position isn't unfairly dragged down by rounds they didn't get to
  // play. PLAYER_AVERAGE only needs the player's mean score per real match, which is just
  // session_points_for / realMatchesPlayed — no need to fetch each individual match score.
  const N = session.max_score_target;
  const halfN = Math.round(N / 2);
  const byeMethod = session.bye_scoring_method;
  const maxRealMatchesPlayed = participatingPlayers.reduce(
    (max: number, p: any) => Math.max(max, p.session_wins + p.session_losses + p.session_draws),
    0
  );

  const standings = participatingPlayers
    .map((p: any) => {
      const wins = p.session_wins;
      const losses = p.session_losses;
      const ties = p.session_draws;
      const realMatchesPlayed = wins + losses + ties;
      const matchesBehind = maxRealMatchesPlayed - realMatchesPlayed;

      const rawByeScore =
        byeMethod === 'HALF_N' || realMatchesPlayed === 0
          ? halfN
          : Math.round(p.session_points_for / realMatchesPlayed);
      const byeScore = Math.max(0, Math.min(N, rawByeScore));
      const byePoints = matchesBehind > 0 ? matchesBehind * byeScore : 0;
      const byeIsPlaceholder = matchesBehind > 0 && realMatchesPlayed === 0;

      const totalPoints = p.session_points_for + byePoints;
      const diff = totalPoints - p.session_points_against;
      return {
        playerId: p.profile_id,
        name: getDisplayName(p.profile),
        wins,
        losses,
        ties,
        totalPoints,
        diff,
        realMatchesPlayed,
        byePoints,
        byesCount: Math.max(0, matchesBehind),
        byeIsPlaceholder,
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.totalPoints - a.totalPoints;
    })
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  const sessionPlayersForBoard = activePlayers.map((p: any) => ({
    id: p.profile_id,
    name: getDisplayName(p.profile),
    avatarUrl: p.profile?.avatar_url ?? null,
    pointsFor: p.session_points_for,
    pointsAgainst: p.session_points_against,
    wins: p.session_wins,
    losses: p.session_losses,
    draws: p.session_draws,
  }));

  const isActiveSession = session.status === 'ACTIVE' || session.status === 'DRAFT' || session.status === 'PAUSED';

  if (!isActiveSession) {
    return (
      <SessionResults
        communitySlug={communitySlug}
        session={{ name: session.session_name, sport: session.sport, format: session.format, status: session.status }}
        rounds={allRounds}
        matches={allMatches}
        standings={standings}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/c/${communitySlug}`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Community
      </Link>

      {/* Clean, simple header with SessionHostsBar */}
      <div className="space-y-2">
        <h1 className="text-lg font-extrabold tracking-tight text-zinc-900">
          {session.session_name}
        </h1>
        <SessionHostsBar
          sessionId={sessionId}
          communityId={session.community_id}
          hosts={hostProfiles}
          communityMembers={communityMemberProfiles}
          isHostOrAdmin={isHostOrAdmin}
        />
      </div>

      <LiveBoardWrapper
        sessionId={sessionId}
        communitySlug={communitySlug}
        isHostOrAdmin={isHostOrAdmin}
        sessionConfig={{
          scoringType: session.scoring_type,
          pointsMode: session.points_mode,
          maxScoreTarget: session.max_score_target,
        }}
        sessionMeta={{ name: session.session_name, sport: session.sport, format: session.format }}
        rounds={allRounds}
        matches={allMatches}
        sessionPlayers={sessionPlayersForBoard}
        standings={standings}
      />
    </div>
  );
}
