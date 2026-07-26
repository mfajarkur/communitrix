'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function claimGuestProfile(guestProfileId: string, communitySlug?: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('claim_guest_profile', {
    p_guest_profile_id: guestProfileId,
  });

  if (error) {
    return { error: error.message };
  }

  if (communitySlug) {
    revalidatePath(`/c/${communitySlug}`);
  }
  revalidatePath('/', 'layout');

  return { success: true };
}
