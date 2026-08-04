'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCommunityAdmin, requireProfile } from '@/server/guards';
import { revalidatePath } from 'next/cache';

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export async function requestSkillLevelAction(
  communityId: string,
  requestedLevel: SkillLevel,
  communitySlug: string
) {
  try {
    await requireProfile();
    const supabase = await createClient();

    const { error } = await supabase.rpc('request_skill_level', {
      p_community_id: communityId,
      p_requested_level: requestedLevel,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/c/${communitySlug}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to request a skill level.' };
  }
}

export async function resolveSkillLevelRequestAction(
  requestId: string,
  action: 'APPROVE' | 'REJECT',
  communitySlug: string,
  communityId: string
) {
  try {
    await requireCommunityAdmin(communityId);
    const supabase = await createClient();

    const { error } = await supabase.rpc('resolve_skill_level_request', {
      p_request_id: requestId,
      p_action: action,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/c/${communitySlug}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Only administrators can resolve skill level requests.' };
  }
}
