'use server';

import { createClient } from '@/lib/supabase/server';
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

export async function resolveClaimAction(requestId: string, action: 'APPROVE' | 'REJECT', communitySlug: string) {
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
}
