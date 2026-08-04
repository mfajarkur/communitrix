'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityAdmin } from '@/server/guards';
import { revalidatePath } from 'next/cache';

export async function resolveJoinRequestAction(
  requestId: string,
  action: 'APPROVE' | 'REJECT',
  communitySlug: string,
  communityId: string
) {
  try {
    await requireCommunityAdmin(communityId);
    const supabase = await createClient();

    const { error } = await supabase.rpc('resolve_join_request', {
      p_request_id: requestId,
      p_action: action,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/c/${communitySlug}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Only administrators can resolve join requests.' };
  }
}
