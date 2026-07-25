'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '../guards';
import { ActionResult } from '../result';
import { revalidatePath } from 'next/cache';

export interface UpdateProfileInput {
  fullName: string;
  avatarUrl: string;
}

export async function updateProfileAction(
  input: UpdateProfileInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const profile = await requireProfile();
    const supabase = await createClient();

    if (!input.fullName || input.fullName.trim().length === 0) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Name is required.',
      };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: input.fullName.trim(),
        avatar_url: input.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (error) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'Failed to update profile.',
      };
    }

    revalidatePath('/c/[communitySlug]/players/[playerId]');

    return {
      ok: true,
      data: { success: true },
    };
  } catch (err: any) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: err.message || 'Unauthorized action.',
    };
  }
}
