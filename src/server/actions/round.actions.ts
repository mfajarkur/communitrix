'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityHost } from '../guards';
import { ActionResult } from '../result';
import { generateAmericanoRound } from '@/lib/matchmaking/americano';
import { generateMexicanoRound } from '@/lib/matchmaking/mexicano';
import { Attendee, MatchHistory, PastPairing, StandingRow } from '@/lib/matchmaking/types';
import { revalidatePath } from 'next/cache';

export interface GenerateRoundResult {
  roundNumber: number;
  courts: {
    courtNumber: number;
    teamA: { id: string; name: string }[];
    teamB: { id: string; name: string }[];
  }[];
  sitOuts: { id: string; name: string }[];
}

export async function generateNextRoundAction(
  sessionId: string,
  roundNumber: number
): Promise<ActionResult<GenerateRoundResult>> {
  try {
    const supabase = await createClient();

    // 1. Fetch Session Info
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .select('community_id, format, sport, court_count, rounds_planned')
      .eq('id', sessionId)
      .single();

    if (sErr || !session) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Session not found.',
      };
    }

    // 2. Admin authorization guard
    await requireCommunityHost(session.community_id);

    // 3. Fetch active attendees
    const { data: players, error: pErr } = await supabase
      .from('session_players')
      .select(`
        profile_id,
        seed_elo,
        matches_played,
        sit_out_count,
        last_sit_out_round,
        session_points_for,
        session_points_against,
        session_wins,
        session_losses,
        session_draws,
        profile:profiles (
          full_name
        )
      `)
      .eq('session_id', sessionId)
      .eq('status', 'ACTIVE');

    if (pErr || !players) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'Failed to fetch session players.',
      };
    }

    const attendees: Attendee[] = players.map(p => ({
      id: p.profile_id,
      seedElo: Number(p.seed_elo),
      matchesPlayed: p.matches_played,
      sitOutCount: p.sit_out_count,
      lastSitOutRound: p.last_sit_out_round,
    }));

    // Mapping profile IDs to names for UI display later
    const idToName = new Map<string, string>();
    players.forEach(p => {
      idToName.set(p.profile_id, (p.profile as any)?.full_name || 'Player');
    });

    // 4. Fetch session matches history
    const { data: rawMatches, error: mErr } = await supabase
      .from('matches')
      .select(`
        id,
        round_number,
        court_number,
        team_a_score,
        team_b_score,
        status,
        match_players (
          profile_id,
          team
        )
      `)
      .eq('session_id', sessionId);

    if (mErr || !rawMatches) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'Failed to fetch match history.',
      };
    }

    // Filter and map to Americano pairing history
    const history: PastPairing[] = rawMatches
      .filter(m => m.status !== 'VOIDED')
      .map(m => {
        const teamA = m.match_players.filter(mp => mp.team === 'A').map(mp => mp.profile_id);
        const teamB = m.match_players.filter(mp => mp.team === 'B').map(mp => mp.profile_id);
        return {
          roundNumber: m.round_number,
          teamA,
          teamB,
        };
      });

    // Determine players per match based on sport (Padel always doubles, tennis default doubles unless courtCount ratio)
    // For V1 Americano/Mexicano we default to doubles (4 players) unless court capacity is set differently.
    const playersPerMatch = 4; // Doubles default

    let roundPlan;
    const seed = `${sessionId}:${roundNumber}`;

    if (session.format === 'AMERICANO') {
      roundPlan = generateAmericanoRound({
        roundNumber,
        playersPerMatch,
        courtCount: session.court_count,
        attendees,
        history,
        seed,
      });
    } else {
      // Mexicano requires standings for round >= 2
      const standings: StandingRow[] = players.map(p => ({
        profileId: p.profile_id,
        matchesPlayed: p.matches_played,
        sessionPointsFor: p.session_points_for,
        sessionPointsAgainst: p.session_points_against,
        sessionWins: p.session_wins,
        sessionLosses: p.session_losses,
        sessionDraws: p.session_draws,
        seedElo: Number(p.seed_elo),
      }));

      // Gather MatchHistory with scores to resolve head-to-head ties
      const matchHistory: MatchHistory[] = rawMatches
        .filter(m => m.status === 'COMPLETED')
        .map(m => {
          const teamA = m.match_players.filter(mp => mp.team === 'A').map(mp => mp.profile_id);
          const teamB = m.match_players.filter(mp => mp.team === 'B').map(mp => mp.profile_id);
          return {
            id: m.id,
            roundNumber: m.round_number,
            teamA,
            teamB,
            scoreA: m.team_a_score,
            scoreB: m.team_b_score,
          };
        });

      roundPlan = generateMexicanoRound({
        roundNumber,
        playersPerMatch,
        courtCount: session.court_count,
        attendees,
        history,
        standings,
        seed,
        options: { avoidRepeatPartner: true },
      });
    }

    // Format proposed matches with player names for presentation
    const courtsOutput = roundPlan.courts.map(c => ({
      courtNumber: c.courtNumber,
      teamA: c.teamA.map(id => ({ id, name: idToName.get(id) || 'Player' })),
      teamB: c.teamB.map(id => ({ id, name: idToName.get(id) || 'Player' })),
    }));

    const sitOutsOutput = roundPlan.sitOuts.map(id => ({
      id,
      name: idToName.get(id) || 'Player',
    }));

    return {
      ok: true,
      data: {
        roundNumber,
        courts: courtsOutput,
        sitOuts: sitOutsOutput,
      },
    };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'Verification failed.',
    };
  }
}

export interface PersistRoundInput {
  sessionId: string;
  roundNumber: number;
  courts: {
    courtNumber: number;
    teamA: string[]; // profile IDs
    teamB: string[]; // profile IDs
  }[];
  sitOuts: string[]; // profile IDs
}

export async function persistRoundAction(
  input: PersistRoundInput
): Promise<ActionResult<{ roundId: string }>> {
  try {
    const supabase = await createClient();

    // 1. Fetch Session Info
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .select('community_id, community:communities(slug)')
      .eq('id', input.sessionId)
      .single();

    if (sErr || !session) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Session not found.',
      };
    }

    // 2. Admin authorization guard
    await requireCommunityHost(session.community_id);

    // 3. Serialize matches for postgres jsonb input
    const matchesJson = input.courts.map(c => ({
      courtNumber: c.courtNumber,
      teamA: c.teamA,
      teamB: c.teamB,
    }));

    // 4. Call persist_round RPC
    const { data: roundId, error: rpcErr } = await supabase.rpc('persist_round', {
      p_session_id: input.sessionId,
      p_round_number: input.roundNumber,
      p_matches: matchesJson,
      p_sit_outs: input.sitOuts,
    });

    if (rpcErr) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: rpcErr.message || 'Failed to save round matches in database.',
      };
    }

    const communitySlug = (session as any).community?.slug;
    if (communitySlug) {
      revalidatePath(`/c/${communitySlug}/sessions`);
    }

    return {
      ok: true,
      data: { roundId },
    };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'Permission denied.',
    };
  }
}

export interface SubmitMatchScoreInput {
  matchId: string;
  scoreA: number;
  scoreB: number;
  communitySlug?: string;
}

export async function submitMatchScoreAction(
  input: SubmitMatchScoreInput
): Promise<ActionResult<{ success: boolean; alreadyScored?: boolean }>> {
  try {
    const supabase = await createClient();

    // 1. Fetch match to verify community context
    const { data: match } = await supabase
      .from('matches')
      .select('community_id')
      .eq('id', input.matchId)
      .maybeSingle();

    if (!match) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Match not found.',
      };
    }

    // 2. Authorization check (Host or Admin)
    await requireCommunityHost(match.community_id);

    // 3. Invoke submit_match_score RPC — returns false instead of silently no-oping when
    // another host already scored this match first (concurrent submission).
    const { data: applied, error: rpcErr } = await supabase.rpc('submit_match_score', {
      p_match_id: input.matchId,
      p_score_a: input.scoreA,
      p_score_b: input.scoreB,
    });

    if (rpcErr) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: rpcErr.message || 'Failed to submit match score.',
      };
    }

    if (input.communitySlug) {
      revalidatePath(`/c/${input.communitySlug}`);
    }

    return {
      ok: true,
      data: { success: true, alreadyScored: applied === false },
    };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'UNKNOWN',
      message: error.message || 'An unexpected error occurred.',
    };
  }
}
