'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityAdmin } from '@/server/guards';
import { revalidatePath } from 'next/cache';

export async function requestClaimAction(guestProfileId: string, communityId: string, communitySlug: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('request_guest_claim', {
    p_guest_profile_id: guestProfileId,
    p_community_id: communityId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/c/${communitySlug}`);
  return { success: true };
}

export async function resolveClaimAction(requestId: string, action: 'APPROVE' | 'REJECT', communitySlug: string, communityId: string) {
  try {
    await requireCommunityAdmin(communityId);
    const supabase = await createClient();

    const { error } = await supabase.rpc('resolve_guest_claim', {
      p_request_id: requestId,
      p_action: action,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/c/${communitySlug}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Only administrators can resolve claim requests.' };
  }
}

export async function adminMergeGuestAccountAction(input: {
  guestProfileId: string;
  targetProfileId: string;
  communityId: string;
  communitySlug: string;
}) {
  try {
    await requireCommunityAdmin(input.communityId);
    const supabase = await createClient();

    const { error } = await supabase.rpc('claim_guest_profile', {
      p_guest_profile_id: input.guestProfileId,
      p_target_profile_id: input.targetProfileId,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/c/${input.communitySlug}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Only administrators can merge player accounts.' };
  }
}
