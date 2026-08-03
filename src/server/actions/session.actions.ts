'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireCommunityHost, requireCommunityAdmin } from '../guards';
import { ActionResult } from '../result';

export interface StartSessionInput {
  communityId: string;
  name: string;
  format: 'AMERICANO' | 'MEXICANO';
  sport: 'PADEL' | 'TENNIS';
  scoringType: 'POINTS' | 'GAMES';
  pointsMode: 'FIRST_TO_TARGET' | 'FIXED_TOTAL' | 'TIMED';
  maxScoreTarget: number;
  courtCount: number;
  roundsPlanned: number | null;
  attendeeIds: string[];
  byeScoringMethod: 'PLAYER_AVERAGE' | 'HALF_N';
  sessionMode: 'ONLINE' | 'OFFLINE';
}

export async function startSessionAction(
  input: StartSessionInput
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    // 1. Enforce admin guard
    await requireCommunityHost(input.communityId);

    // 2. Validate input constraints
    if (!input.name || input.name.trim().length === 0) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Session name is required.',
      };
    }

    if (input.attendeeIds.length === 0) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'At least one player must be selected.',
      };
    }

    if (input.sport === 'PADEL' && input.attendeeIds.length < 4) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Padel sessions require at least 4 players.',
      };
    }

    if (input.sport === 'TENNIS' && input.format === 'AMERICANO' && input.attendeeIds.length < 2) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Tennis Americano sessions require at least 2 players.',
      };
    }

    const supabase = await createClient();

    // 3. Call start_session RPC
    const { data: sessionId, error } = await supabase.rpc('start_session', {
      p_community_id: input.communityId,
      p_name: input.name.trim(),
      p_format: input.format,
      p_sport: input.sport,
      p_scoring_type: input.scoringType,
      p_points_mode: input.pointsMode,
      p_max_score_target: input.maxScoreTarget,
      p_rounds_planned: input.roundsPlanned,
      p_court_count: input.courtCount,
      p_attendee_ids: input.attendeeIds,
      p_bye_scoring_method: input.byeScoringMethod,
      p_session_mode: input.sessionMode,
    });

    if (error) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'Failed to start the session in the database.',
      };
    }

    return {
      ok: true,
      data: { sessionId },
    };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'You do not have permission to perform this action.',
    };
  }
}

export interface UploadOfflineSessionInput {
  communityId: string;
  communitySlug: string;
  name: string;
  format: 'AMERICANO' | 'MEXICANO';
  sport: 'PADEL' | 'TENNIS';
  scoringType: 'POINTS' | 'GAMES';
  pointsMode: 'FIRST_TO_TARGET' | 'FIXED_TOTAL' | 'TIMED';
  maxScoreTarget: number;
  courtCount: number;
  byeScoringMethod: 'PLAYER_AVERAGE' | 'HALF_N';
  // Already resolved to real profile IDs client-side (pendingGuestCreations awaited) — this
  // action never sees a temp/local ID.
  attendeeIds: string[];
  rounds: {
    roundNumber: number;
    courts: {
      courtNumber: number;
      teamA: string[];
      teamB: string[];
      scoreA: number;
      scoreB: number;
    }[];
    sitOuts: string[];
  }[];
}

// Offline sessions play entirely on one device using Quick Match's local engine, then upload
// here in one shot when the host ends the session — this is the only point an Offline session
// ever touches the database. Reuses start_session / persist_round / submit_match_score /
// finalize_session exactly as a live Online host would call them, one round at a time (not
// batched), so each round's Elo calculation sees the correctly-updated ratings from the round
// before it. No new RPCs, no new Elo/CP/bye-point logic.
export async function uploadOfflineSessionAction(
  input: UploadOfflineSessionInput
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    await requireCommunityHost(input.communityId);

    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, code: 'VALIDATION', message: 'Session name is required.' };
    }
    if (input.attendeeIds.length === 0) {
      return { ok: false, code: 'VALIDATION', message: 'At least one player must be selected.' };
    }
    if (input.rounds.length === 0) {
      return { ok: false, code: 'VALIDATION', message: 'No fully-scored rounds to upload.' };
    }

    const supabase = await createClient();

    // 1. Create the session now, at upload time — nothing existed server-side before this.
    const { data: sessionId, error: startErr } = await supabase.rpc('start_session', {
      p_community_id: input.communityId,
      p_name: input.name.trim(),
      p_format: input.format,
      p_sport: input.sport,
      p_scoring_type: input.scoringType,
      p_points_mode: input.pointsMode,
      p_max_score_target: input.maxScoreTarget,
      p_rounds_planned: null,
      p_court_count: input.courtCount,
      p_attendee_ids: input.attendeeIds,
      p_bye_scoring_method: input.byeScoringMethod,
      p_session_mode: 'OFFLINE',
    });

    if (startErr || !sessionId) {
      return { ok: false, code: 'UNKNOWN', message: startErr?.message || 'Failed to create the session.' };
    }

    // 2. Replay every round sequentially: persist -> look up the real match IDs it created (in
    // court order, same pattern tests/unit/elo-sql-sync.test.ts already uses) -> score each one.
    for (const round of input.rounds) {
      const { data: roundId, error: roundErr } = await supabase.rpc('persist_round', {
        p_session_id: sessionId,
        p_round_number: round.roundNumber,
        p_matches: round.courts.map((c) => ({
          courtNumber: c.courtNumber,
          teamA: c.teamA,
          teamB: c.teamB,
        })),
        p_sit_outs: round.sitOuts,
      });

      if (roundErr || !roundId) {
        return {
          ok: false,
          code: 'UNKNOWN',
          message:
            (roundErr?.message || `Failed to upload round ${round.roundNumber}.`) +
            ' The session was already created and partially uploaded — check the community Sessions list to finish it from the Live Board instead of retrying here.',
        };
      }

      const { data: persistedMatches, error: matchesErr } = await supabase
        .from('matches')
        .select('id, court_number')
        .eq('round_id', roundId)
        .order('court_number', { ascending: true });

      if (matchesErr || !persistedMatches) {
        return {
          ok: false,
          code: 'UNKNOWN',
          message: matchesErr?.message || `Failed to load round ${round.roundNumber}'s matches after upload.`,
        };
      }

      for (const court of round.courts) {
        const match = persistedMatches.find((m) => m.court_number === court.courtNumber);
        if (!match) continue;

        const { error: scoreErr } = await supabase.rpc('submit_match_score', {
          p_match_id: match.id,
          p_score_a: court.scoreA,
          p_score_b: court.scoreB,
        });

        if (scoreErr) {
          return {
            ok: false,
            code: 'UNKNOWN',
            message:
              (scoreErr.message || `Failed to save the score for round ${round.roundNumber}, court ${court.courtNumber}.`) +
              ' The session was already created and partially uploaded — check the community Sessions list to finish it from the Live Board instead of retrying here.',
          };
        }
      }
    }

    // 3. Finalize — marks COMPLETED and awards Community Points (finalize_session, 0029).
    const { error: finalizeErr } = await supabase.rpc('finalize_session', {
      p_session_id: sessionId,
    });

    if (finalizeErr) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message:
          (finalizeErr.message || 'Failed to finalize the uploaded session.') +
          ' All rounds were uploaded successfully — an admin can finish finalizing it from the Live Board.',
      };
    }

    const { revalidatePath } = require('next/cache');
    revalidatePath(`/c/${input.communitySlug}`);
    revalidatePath(`/c/${input.communitySlug}/sessions/${sessionId}`);

    return { ok: true, data: { sessionId } };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'Failed to upload the offline session.',
    };
  }
}

export async function finalizeSessionAction(
  sessionId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient();

    // 1. Fetch session community_id for authorization
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .select('community_id, community:communities(slug)')
      .eq('id', sessionId)
      .single();

    if (sErr || !session) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Session not found.',
      };
    }

    // 2. Enforce admin guard
    await requireCommunityHost(session.community_id);

    // 3. Call finalize_session RPC
    const { error: rpcErr } = await supabase.rpc('finalize_session', {
      p_session_id: sessionId,
    });

    if (rpcErr) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: rpcErr.message || 'Failed to finalize session.',
      };
    }

    const communitySlug = (session as any).community?.slug;
    if (communitySlug) {
      revalidatePath(`/c/${communitySlug}/sessions/${sessionId}`);
      revalidatePath(`/c/${communitySlug}`);
    }

    return {
      ok: true,
      data: { success: true },
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

export async function startNewCpSeasonAction(
  communityId: string,
  communitySlug?: string
): Promise<ActionResult<{ seasonId: string }>> {
  try {
    const supabase = await createClient();

    // 1. Enforce Admin guard
    await requireCommunityAdmin(communityId);

    // 2. Invoke start_new_cp_season RPC
    const { data: seasonId, error: rpcErr } = await supabase.rpc('start_new_cp_season', {
      p_community_id: communityId,
    });

    if (rpcErr) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: rpcErr.message || 'Failed to start new CP season.',
      };
    }

    if (communitySlug) {
      const { revalidatePath } = require('next/cache');
      revalidatePath(`/c/${communitySlug}`);
    }

    return {
      ok: true,
      data: { seasonId },
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
