import { createClient } from '@/lib/supabase/server';
import { requireCommunityAdmin } from '@/server/guards';
import { notFound } from 'next/navigation';
import ScorerForm from './scorer-form';

export default async function MatchScorerPage({
  params,
}: {
  params: Promise<{ communitySlug: string; sessionId: string; matchId: string }>;
}) {
  const { communitySlug, sessionId, matchId } = await params;
  const supabase = await createClient();

  // 1. Fetch match details
  const { data: match, error: mErr } = await supabase
    .from('matches')
    .select(`
      id,
      court_number,
      round_number,
      status,
      team_a_score,
      team_b_score,
      session_id,
      community_id,
      match_players (
        profile_id,
        team,
        slot,
        elo_before,
        profile:profiles (
          full_name
        )
      )
    `)
    .eq('id', matchId)
    .single();

  if (mErr || !match) {
    notFound();
  }

  // 2. Enforce admin guard
  await requireCommunityAdmin(match.community_id);

  // 3. Fetch session settings
  const { data: session, error: sErr } = await supabase
    .from('sessions')
    .select('sport, scoring_type, points_mode, max_score_target, court_count, rounds_planned, format, match_type')
    .eq('id', sessionId)
    .single();

  if (sErr || !session) {
    notFound();
  }

  // 4. Fetch total attendee count and provisional match counts for ELO preview calculations
  const { count: attendeeCount } = await supabase
    .from('session_players')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('status', 'ACTIVE');

  const playerIds = match.match_players.map(mp => mp.profile_id);

  const { data: rankings, error: rErr } = await supabase
    .from('player_rankings')
    .select('profile_id, total_matches')
    .eq('community_id', match.community_id)
    .eq('sport', session.sport)
    .in('profile_id', playerIds);

  const rankingMap = new Map<string, number>();
  rankings?.forEach(r => {
    rankingMap.set(r.profile_id, r.total_matches);
  });

  // Map match players into clean structures
  const players = match.match_players.map((mp: any) => ({
    id: mp.profile_id,
    fullName: mp.profile?.full_name || 'Unknown Player',
    team: mp.team as 'A' | 'B',
    slot: mp.slot,
    eloBefore: Number(mp.elo_before),
    totalMatchesPlayed: rankingMap.get(mp.profile_id) || 0,
  }));

  const teamA = players.filter(p => p.team === 'A').sort((a, b) => a.slot - b.slot);
  const teamB = players.filter(p => p.team === 'B').sort((a, b) => a.slot - b.slot);

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-8 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
            Court {match.court_number} • Round {match.round_number}
          </span>
          <h1 className="text-2xl font-black tracking-tight mt-1">Courtside Scorer</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Tap the scores to adjust, view the Elo preview below, and send the score.
          </p>
        </div>

        <ScorerForm
          matchId={match.id}
          sessionId={sessionId}
          communitySlug={communitySlug}
          teamAPlayers={teamA}
          teamBPlayers={teamB}
          initialScoreA={match.team_a_score ?? 0}
          initialScoreB={match.team_b_score ?? 0}
          initialStatus={match.status}
          sessionConfig={{
            sport: session.sport,
            scoringType: session.scoring_type,
            pointsMode: session.points_mode,
            maxScoreTarget: session.max_score_target,
            roundsPlanned: session.rounds_planned,
            courtCount: session.court_count,
            matchType: session.match_type,
            format: session.format,
            attendeeCount: attendeeCount || 4,
          }}
        />
      </div>
    </div>
  );
}
