'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityAdmin, requireCommunityHost } from '../guards';
import { ActionResult } from '../result';
import { revalidatePath } from 'next/cache';

export interface SubmitMatchScoreInput {
  matchId: string;
  scoreA: number;
  scoreB: number;
}

export async function submitMatchScoreAction(
  input: SubmitMatchScoreInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient();

    // 1. Fetch match to get community_id for authorization check
    const { data: match, error: mErr } = await supabase
      .from('matches')
      .select('community_id, session_id')
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
    await requireCommunityHost(match.community_id);

    // 3. Call submit_match_score RPC
    const { error: rpcErr } = await supabase.rpc('submit_match_score', {
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

    // 4. Revalidate session board page cache
    revalidatePath(`/c/[communitySlug]/sessions/${match.session_id}`);

    return {
      ok: true,
      data: { success: true },
    };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'You do not have permission to score this match.',
    };
  }
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
      .select('community_id, session_id')
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
    revalidatePath(`/c/[communitySlug]/sessions/${match.session_id}`);

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
      .select('community_id, session_id')
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
    revalidatePath(`/c/[communitySlug]/sessions/${match.session_id}`);

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
