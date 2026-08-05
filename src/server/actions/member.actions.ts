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

    // 3. Call the RPC add_guest_player — gender is set in the same call (security definer),
    // instead of a separate follow-up `profiles` UPDATE that RLS silently rejected for
    // HOST callers (that policy only allows ADMIN).
    const supabase = await createClient();
    const { data: guestProfile, error } = await supabase
      .rpc('add_guest_player', {
        p_community_id: input.communityId,
        p_full_name: toTitleCase(input.fullName.trim()),
        p_gender: input.gender ?? null,
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
      message: error.message || 'Only community hosts and administrators can add guest players.',
    };
  }
}

export async function updateMemberRoleAction(input: {
  communityId: string;
  targetProfileId: string;
  newRole: 'ADMIN' | 'MEMBER';
  communitySlug?: string;
}): Promise<ActionResult<any>> {
  try {
    // ADMIN ONLY can assign member roles / levels
    await requireCommunityAdmin(input.communityId);

    const supabase = await createClient();

    const { data: targetMember, error: fetchError } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', input.communityId)
      .eq('profile_id', input.targetProfileId)
      .maybeSingle();

    if (fetchError || !targetMember) {
      return { ok: false, code: 'NOT_FOUND', message: 'This member is no longer in the community.' };
    }

    if (targetMember.role === 'ADMIN' && input.newRole !== 'ADMIN') {
      const { count } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', input.communityId)
        .eq('role', 'ADMIN')
        .eq('is_active', true);

      if ((count ?? 0) <= 1) {
        return {
          ok: false,
          code: 'VALIDATION',
          message: "Can't change this member's role — they're the community's last active admin.",
        };
      }
    }

    const { data, error } = await supabase
      .from('community_members')
      .update({ role: input.newRole })
      .eq('community_id', input.communityId)
      .eq('profile_id', input.targetProfileId)
      .select('profile_id');

    if (error) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'Failed to update member role.',
      };
    }

    if (!data || data.length === 0) {
      return { ok: false, code: 'NOT_FOUND', message: 'This member is no longer in the community.' };
    }

    if (input.communitySlug) {
      revalidatePath(`/c/${input.communitySlug}`);
    }

    return { ok: true, data: null };
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

    const { data: targetMember, error: fetchError } = await supabase
      .from('community_members')
      .select('role, is_active')
      .eq('community_id', input.communityId)
      .eq('profile_id', input.targetProfileId)
      .maybeSingle();

    if (fetchError || !targetMember) {
      return { ok: false, code: 'NOT_FOUND', message: 'This member is no longer in the community.' };
    }

    if (targetMember.role === 'ADMIN' && targetMember.is_active) {
      const { count } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', input.communityId)
        .eq('role', 'ADMIN')
        .eq('is_active', true);

      if ((count ?? 0) <= 1) {
        return {
          ok: false,
          code: 'VALIDATION',
          message: "Can't remove this member — they're the community's last active admin.",
        };
      }
    }

    const { data, error } = await supabase
      .from('community_members')
      .update({ is_active: false })
      .eq('community_id', input.communityId)
      .eq('profile_id', input.targetProfileId)
      .select('profile_id');

    if (error) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'Failed to remove member from community.',
      };
    }

    if (!data || data.length === 0) {
      return { ok: false, code: 'NOT_FOUND', message: 'This member is no longer in the community.' };
    }

    if (input.communitySlug) {
      revalidatePath(`/c/${input.communitySlug}`);
    }

    return { ok: true, data: null };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: error.message || 'Only administrators can remove members.',
    };
  }
}
