import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { notFound } from 'next/navigation';
import LiveBoardWrapper from './live-board-wrapper';
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
    .select('id, session_name, sport, format, status, court_count, rounds_planned, community_id')
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

  const isAdmin = membership?.role === 'ADMIN';

  // 3. Fetch latest round
  const { data: rounds, error: rErr } = await supabase
    .from('rounds')
    .select('id, round_number, status')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: false });

  const latestRound = rounds && rounds.length > 0 ? rounds[0] : null;

  // 4. Fetch matches of latest round (if exists)
  let matches: any[] = [];
  if (latestRound) {
    const { data: mData } = await supabase
      .from('matches')
      .select(`
        id,
        court_number,
        round_number,
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
      .eq('round_id', latestRound.id)
      .order('court_number', { ascending: true });

    matches = mData || [];
  }

  // 5. Fetch Active Session Players to calculate sit-outs
  const { data: sessionPlayers } = await supabase
    .from('session_players')
    .select(`
      profile_id,
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
    .eq('status', 'ACTIVE');

  const activePlayers = sessionPlayers || [];

  // Determine sit-outs for the current round
  const playingPlayerIds = new Set(
    matches.flatMap(m => m.match_players.map((mp: any) => mp.profile_id))
  );
  
  const sitOuts = activePlayers
    .filter(p => !playingPlayerIds.has(p.profile_id))
    .map((p: any) => ({
      id: p.profile_id,
      name: getDisplayName(p.profile),
      stats: {
        pointsFor: p.session_points_for,
        pointsAgainst: p.session_points_against,
        wins: p.session_wins,
        losses: p.session_losses,
        draws: p.session_draws,
      }
    }));

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
        isAdmin={isAdmin}
        latestRound={latestRound}
        matches={matches}
        sitOuts={sitOuts}
        sessionPlayers={activePlayers.map((p: any) => ({
          id: p.profile_id,
          name: getDisplayName(p.profile),
          pointsFor: p.session_points_for,
          pointsAgainst: p.session_points_against,
          wins: p.session_wins,
          losses: p.session_losses,
          draws: p.session_draws,
        }))}
      />
    </div>
  );
}
