import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { notFound } from 'next/navigation';
import LiveBoardWrapper from './live-board-wrapper';
import SessionResults from './session-results';
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
    .select('id, session_name, sport, format, status, court_count, rounds_planned, community_id, scoring_type, points_mode, max_score_target')
    .eq('id', sessionId)
    .single();

  if (sErr || !session) {
    notFound();
  }

  // 2. Fetch User Membership Role
  const { data: membership } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', session.community_id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  const isHostOrAdmin = membership?.role === 'ADMIN' || membership?.role === 'HOST';

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
      match_players (
        profile_id,
        team,
        slot,
        profile:profiles (
          full_name,
          display_name
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
      profile:profiles (
        full_name,
        display_name
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
  const standings = participatingPlayers
    .map((p: any) => {
      const wins = p.session_wins;
      const losses = p.session_losses;
      const ties = p.session_draws;
      const totalPoints = p.session_points_for;
      const diff = p.session_points_for - p.session_points_against;
      return {
        playerId: p.profile_id,
        name: getDisplayName(p.profile),
        wins,
        losses,
        ties,
        totalPoints,
        diff,
        realMatchesPlayed: wins + losses + ties,
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-150 pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-orange-500">
            Live Session Dashboard
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mt-1">
            {session.session_name}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Format: <span className="font-bold uppercase">{session.format}</span> • Sport:{' '}
            <span className="font-bold uppercase">{session.sport}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50">
            {session.status === 'ACTIVE' ? 'Active Playing' : session.status}
          </span>
        </div>
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
