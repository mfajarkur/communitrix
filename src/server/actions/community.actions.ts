'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { type ActionResult } from '@/server/result';

export async function createCommunityAction(input: {
  name: string;
  slug: string;
}): Promise<ActionResult<any>> {
  try {
    // 1. Ensure user is authenticated and has a profile
    await requireProfile();

    // 2. Validate input
    if (!input.name || input.name.trim().length < 2 || input.name.trim().length > 60) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Community name must be between 2 and 60 characters.',
        fieldErrors: { name: ['Name must be between 2 and 60 characters.'] },
      };
    }

    const slugRegex = /^[a-z0-9-]{3,40}$/;
    if (!input.slug || !slugRegex.test(input.slug)) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Slug must be between 3 and 40 characters and contain only lowercase letters, numbers, and hyphens.',
        fieldErrors: { slug: ['Slug must contain only lowercase letters, numbers, and hyphens (3-40 chars).'] },
      };
    }

    // 3. Call the RPC create_community
    const supabase = await createClient();
    const { data: community, error } = await supabase
      .rpc('create_community', {
        p_name: input.name.trim(),
        p_slug: input.slug.trim(),
      });

    if (error) {
      if (error.code === '23505') { // Unique constraint violation (e.g. duplicate slug)
        return {
          ok: false,
          code: 'CONFLICT',
          message: 'A community with this slug or join code already exists. Please choose a different slug.',
        };
      }
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'An unexpected database error occurred.',
      };
    }

    return { ok: true, data: community };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error; // Allow Next.js redirects to work
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: error.message || 'Authentication required.',
    };
  }
}

export async function joinCommunityAction(input: {
  joinCode: string;
}): Promise<ActionResult<any>> {
  try {
    // 1. Ensure user is authenticated and has a profile
    await requireProfile();

    // 2. Validate input
    if (!input.joinCode || input.joinCode.trim().length === 0) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Join code is required.',
      };
    }

    // 3. Call the RPC join_community
    const supabase = await createClient();
    const { data: member, error } = await supabase
      .rpc('join_community', {
        p_join_code: input.joinCode.trim().toUpperCase(),
      });

    if (error) {
      if (error.message?.includes('Community not found') || error.code === 'P0002') {
        return {
          ok: false,
          code: 'NOT_FOUND',
          message: 'Invalid join code. No community found with this code.',
        };
      }
      if (error.message?.includes('Join code is disabled')) {
        return {
          ok: false,
          code: 'FORBIDDEN',
          message: 'This community has disabled joining via code.',
        };
      }
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'An unexpected database error occurred.',
      };
    }

    // Fetch the community slug for client-side redirection
    const { data: community } = await supabase
      .from('communities')
      .select('slug, name')
      .eq('id', member.community_id)
      .single();

    return { ok: true, data: { member, community } };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: error.message || 'Authentication required.',
    };
  }
}
