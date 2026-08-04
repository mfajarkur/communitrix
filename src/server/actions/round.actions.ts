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
      .select('community_id, format, sport, match_type, court_count, rounds_planned')
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
        fixed_partner_profile_id,
        profile:profiles!session_players_profile_id_fkey (
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

    // Mapping profile IDs to names for UI display later
    const idToName = new Map<string, string>();
    players.forEach(p => {
      idToName.set(p.profile_id, (p.profile as any)?.full_name || 'Player');
    });

    // Team Americano/Mexicano ("fixed pairs"): schedule using one synthetic ID per pair (the
    // matchmaking engines don't care whether an attendee id represents one person), then expand
    // back to the two real profile IDs right before returning — see
    // supabase/migrations/0034_team_fixed_pairs.sql for why this needs no SQL changes at all.
    const isFixedPairMode = players.some(p => p.fixed_partner_profile_id);
    const partnerOf = new Map<string, string>();
    players.forEach(p => {
      if (p.fixed_partner_profile_id) partnerOf.set(p.profile_id, p.fixed_partner_profile_id);
    });
    const teamUnitOf = (profileId: string): string => {
      const partner = partnerOf.get(profileId);
      if (!partner) return profileId;
      return profileId < partner ? profileId : partner;
    };
    const teamUnitMembers = new Map<string, string[]>();
    if (isFixedPairMode) {
      players.forEach(p => {
        const unit = teamUnitOf(p.profile_id);
        const members = teamUnitMembers.get(unit) || [];
        if (!members.includes(p.profile_id)) members.push(p.profile_id);
        teamUnitMembers.set(unit, members);
      });
    }
    const expandUnit = (unitId: string): string[] => teamUnitMembers.get(unitId) || [unitId];

    const attendees: Attendee[] = isFixedPairMode
      ? Array.from(teamUnitMembers.entries()).map(([unitId, memberIds]) => {
          // Partners always play together, so their per-round stats stay in lockstep — sourcing
          // from whichever member the unit id itself belongs to is safe and avoids double-counting.
          const rep = players.find(p => p.profile_id === unitId)!;
          return {
            id: unitId,
            seedElo: memberIds.reduce((sum, id) => sum + Number(players.find(p => p.profile_id === id)!.seed_elo), 0) / memberIds.length,
            matchesPlayed: rep.matches_played,
            sitOutCount: rep.sit_out_count,
            lastSitOutRound: rep.last_sit_out_round,
          };
        })
      : players.map(p => ({
          id: p.profile_id,
          seedElo: Number(p.seed_elo),
          matchesPlayed: p.matches_played,
          sitOutCount: p.sit_out_count,
          lastSitOutRound: p.last_sit_out_round,
        }));

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

    // Dedupes after mapping real profile IDs to their team-unit ID — both partners on a side
    // collapse to the same unit id, matching the "2 real players = 1 scheduling attendee" shape
    // the engines expect from fixed-pair mode.
    const toUnitSide = (ids: string[]): string[] =>
      isFixedPairMode ? Array.from(new Set(ids.map(teamUnitOf))) : ids;

    // Filter and map to Americano pairing history
    const history: PastPairing[] = rawMatches
      .filter(m => m.status !== 'VOIDED')
      .map(m => {
        const teamA = m.match_players.filter(mp => mp.team === 'A').map(mp => mp.profile_id);
        const teamB = m.match_players.filter(mp => mp.team === 'B').map(mp => mp.profile_id);
        return {
          roundNumber: m.round_number,
          teamA: toUnitSide(teamA),
          teamB: toUnitSide(teamB),
        };
      });

    // Fixed-pair mode always schedules exactly one team-unit per side (a pair vs a pair) —
    // independent of match_type, which only matters for regular (non-team) Singles/Doubles.
    // Mirrors the same match_type branch already live in submit_match_score/replay_ratings
    // (supabase/migrations/0028) for the non-team case.
    const playersPerMatch = isFixedPairMode ? 2 : session.match_type === 'SINGLES' ? 2 : 4;

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
      // Mexicano requires standings for round >= 2 — team-unit scoped in fixed-pair mode
      // (partners always share identical stats, so either member's row represents the unit).
      const standings: StandingRow[] = isFixedPairMode
        ? Array.from(teamUnitMembers.keys()).map(unitId => {
            const rep = players.find(p => p.profile_id === unitId)!;
            return {
              profileId: unitId,
              matchesPlayed: rep.matches_played,
              sessionPointsFor: rep.session_points_for,
              sessionPointsAgainst: rep.session_points_against,
              sessionWins: rep.session_wins,
              sessionLosses: rep.session_losses,
              sessionDraws: rep.session_draws,
              seedElo: Number(rep.seed_elo),
            };
          })
        : players.map(p => ({
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
            teamA: toUnitSide(teamA),
            teamB: toUnitSide(teamB),
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

    // Format proposed matches with player names for presentation — expanding each team-unit id
    // back into its two real profile ids so every consumer from here on (persistRoundAction,
    // the Live Board, Elo/standings) sees a normal doubles match, same as it always has.
    const courtsOutput = roundPlan.courts.map(c => ({
      courtNumber: c.courtNumber,
      teamA: c.teamA.flatMap(expandUnit).map(id => ({ id, name: idToName.get(id) || 'Player' })),
      teamB: c.teamB.flatMap(expandUnit).map(id => ({ id, name: idToName.get(id) || 'Player' })),
    }));

    const sitOutsOutput = roundPlan.sitOuts.flatMap(expandUnit).map(id => ({
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

    // 1. Fetch match to verify community context and session_id
    const { data: match } = await supabase
      .from('matches')
      .select('community_id, session_id')
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
      console.error('RPC submit_match_score error:', rpcErr);
      return {
        ok: false,
        code: 'UNKNOWN',
        message: rpcErr.message || 'Failed to submit match score.',
      };
    }

    if (input.communitySlug && match.session_id) {
      revalidatePath(`/c/${input.communitySlug}/sessions/${match.session_id}`);
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
