'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityAdmin, requireCommunityHost } from '@/server/guards';
import { type ActionResult } from '@/server/result';
import { revalidatePath } from 'next/cache';
import { toTitleCase } from '@/lib/utils/profile';

export async function addGuestPlayerAction(input: {
  communityId: string;
  fullName: string;
  gender?: 'MALE' | 'FEMALE';
}): Promise<ActionResult<any>> {
  try {
    // 1. Ensure user is authenticated, has a profile, and is at least community host or admin
    await requireCommunityHost(input.communityId);

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
        p_full_name: toTitleCase(input.fullName.trim()),
      });

    if (error) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'An unexpected database error occurred.',
      };
    }

    if (input.gender && guestProfile?.id) {
      await supabase.from('profiles').update({ gender: input.gender }).eq('id', guestProfile.id);
    }

    return { ok: true, data: guestProfile };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'Only community hosts and administrators can add guest players.',
    };
  }
}

export async function updateMemberRoleAction(input: {
  communityId: string;
  targetProfileId: string;
  newRole: 'ADMIN' | 'HOST' | 'MEMBER';
  communitySlug?: string;
}): Promise<ActionResult<any>> {
  try {
    // ADMIN ONLY can assign member roles / levels
    await requireCommunityAdmin(input.communityId);

    const supabase = await createClient();
    const { error } = await supabase
      .from('community_members')
      .update({ role: input.newRole })
      .eq('community_id', input.communityId)
      .eq('profile_id', input.targetProfileId);

    if (error) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'Failed to update member role.',
      };
    }

    if (input.communitySlug) {
      revalidatePath(`/c/${input.communitySlug}`);
    }

    return { ok: true };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'Only administrators can assign member roles.',
    };
  }
}

export async function removeMemberAction(input: {
  communityId: string;
  targetProfileId: string;
  communitySlug?: string;
}): Promise<ActionResult<any>> {
  try {
    // ADMIN ONLY can remove members
    await requireCommunityAdmin(input.communityId);

    const supabase = await createClient();
    const { error } = await supabase
      .from('community_members')
      .update({ is_active: false })
      .eq('community_id', input.communityId)
      .eq('profile_id', input.targetProfileId);

    if (error) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'Failed to remove member from community.',
      };
    }

    if (input.communitySlug) {
      revalidatePath(`/c/${input.communitySlug}`);
    }

    return { ok: true };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'Only administrators can remove members.',
    };
  }
}
