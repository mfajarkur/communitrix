'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityAdmin } from '@/server/guards';
import { type ActionResult } from '@/server/result';

export async function addGuestPlayerAction(input: {
  communityId: string;
  fullName: string;
}): Promise<ActionResult<any>> {
  try {
    // 1. Ensure user is authenticated, has a profile, and is community admin
    await requireCommunityAdmin(input.communityId);

    // 2. Validate input
    if (!input.fullName || input.fullName.trim().length < 1 || input.fullName.trim().length > 60) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Guest player full name must be between 1 and 60 characters.',
        fieldErrors: { fullName: ['Name must be between 1 and 60 characters.'] },
      };
    }

    // 3. Call the RPC add_guest_player
    const supabase = await createClient();
    const { data: guestProfile, error } = await supabase
      .rpc('add_guest_player', {
        p_community_id: input.communityId,
        p_full_name: input.fullName.trim(),
      });

    if (error) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'An unexpected database error occurred.',
      };
    }

    return { ok: true, data: guestProfile };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'Only community administrators can add guest players.',
    };
  }
}
