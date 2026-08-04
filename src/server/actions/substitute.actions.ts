'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityHost } from '../guards';
import { ActionResult } from '../result';
import { revalidatePath } from 'next/cache';

export interface SetMatchSubstituteInput {
  matchId: string;
  originalProfileId: string;
  // null = unmark an existing substitution and restore the original player.
  substituteProfileId: string | null;
  communitySlug?: string;
}

// Marks/changes/unmarks a mid-match "joki" substitute — see supabase/migrations/0037's
// set_match_substitute for the actual attribution split (game/session stats stay on the
// original player, Elo moves to the substitute, plus a CP penalty on first mark).
export async function setMatchSubstituteAction(
  input: SetMatchSubstituteInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient();

    const { data: match } = await supabase
      .from('matches')
      .select('community_id, session_id')
      .eq('id', input.matchId)
      .maybeSingle();

    if (!match) {
      return { ok: false, code: 'NOT_FOUND', message: 'Match not found.' };
    }

    await requireCommunityHost(match.community_id);

    const { error: rpcErr } = await supabase.rpc('set_match_substitute', {
      p_match_id: input.matchId,
      p_original_profile_id: input.originalProfileId,
      p_substitute_profile_id: input.substituteProfileId,
    });

    if (rpcErr) {
      console.error('RPC set_match_substitute error:', rpcErr);
      return { ok: false, code: 'UNKNOWN', message: rpcErr.message || 'Failed to set match substitute.' };
    }

    if (input.communitySlug && match.session_id) {
      revalidatePath(`/c/${input.communitySlug}/sessions/${match.session_id}`);
    }

    return { ok: true, data: { success: true } };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return { ok: false, code: 'FORBIDDEN', message: error.message || 'Verification failed.' };
  }
}
