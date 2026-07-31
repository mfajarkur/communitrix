'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityAdmin } from '../guards';
import { ActionResult } from '../result';
import { revalidatePath } from 'next/cache';
import {
  submitMatchScoreAction as submitMatchScoreActionImpl,
  type SubmitMatchScoreInput,
} from './round.actions';

export type { SubmitMatchScoreInput };

// Score submission lived here as a second, drifting implementation of the same operation
// already in round.actions.ts (used by the community Live Board) — this file must still
// declare its own top-level async function (Next.js's "use server" transform doesn't support
// `export { x } from 'y'` re-exports), but it now just delegates to the one shared body
// instead of duplicating the logic.
export async function submitMatchScoreAction(
  input: SubmitMatchScoreInput
): Promise<ActionResult<{ success: boolean }>> {
  return submitMatchScoreActionImpl(input);
}

export interface AmendMatchScoreInput {
  matchId: string;
  scoreA: number;
  scoreB: number;
  reason: string;
}

export async function amendMatchScoreAction(
  input: AmendMatchScoreInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient();

    // 1. Fetch match to get community_id for authorization check
    const { data: match, error: mErr } = await supabase
      .from('matches')
      .select('community_id, session_id, community:communities(slug)')
      .eq('id', input.matchId)
      .single();

    if (mErr || !match) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Match not found.',
      };
    }

    // 2. Enforce admin guard
    await requireCommunityAdmin(match.community_id);

    // 3. Call amend_match_score RPC
    const { error: rpcErr } = await supabase.rpc('amend_match_score', {
      p_match_id: input.matchId,
      p_score_a: input.scoreA,
      p_score_b: input.scoreB,
      p_reason: input.reason,
    });

    if (rpcErr) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: rpcErr.message || 'Failed to amend match score.',
      };
    }

    // 4. Revalidate session board page cache
    const communitySlug = (match as any).community?.slug;
    if (communitySlug) {
      revalidatePath(`/c/${communitySlug}/sessions/${match.session_id}`);
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

export interface VoidMatchInput {
  matchId: string;
  reason: string;
}

export async function voidMatchAction(
  input: VoidMatchInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient();

    // 1. Fetch match to get community_id for authorization check
    const { data: match, error: mErr } = await supabase
      .from('matches')
      .select('community_id, session_id, community:communities(slug)')
      .eq('id', input.matchId)
      .single();

    if (mErr || !match) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Match not found.',
      };
    }

    // 2. Enforce admin guard
    await requireCommunityAdmin(match.community_id);

    // 3. Call void_match RPC
    const { error: rpcErr } = await supabase.rpc('void_match', {
      p_match_id: input.matchId,
      p_reason: input.reason,
    });

    if (rpcErr) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: rpcErr.message || 'Failed to void match.',
      };
    }

    // 4. Revalidate session board page cache
    const communitySlug = (match as any).community?.slug;
    if (communitySlug) {
      revalidatePath(`/c/${communitySlug}/sessions/${match.session_id}`);
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
