'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityAdmin } from '../guards';
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
}

export async function startSessionAction(
  input: StartSessionInput
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    // 1. Enforce admin guard
    await requireCommunityAdmin(input.communityId);

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
