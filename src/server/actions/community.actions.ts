'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/server/guards';
import { type ActionResult } from '@/server/result';
import { revalidatePath } from 'next/cache';

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

export async function uploadCommunityLogoAction(formData: FormData) {
  const supabase = await createClient();
  const communityId = formData.get('community_id') as string;
  const communitySlug = formData.get('community_slug') as string;
  const file = formData.get('logo') as File;

  if (!communityId || !file || file.size === 0) {
    return { error: 'Invalid parameters or file missing' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: 'File size must be under 5MB' };
  }

  // 1. Check user authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Authentication required' };
  }

  // 2. Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    return { error: 'Profile not found' };
  }

  // 3. Verify user is ADMIN of this community
  const { data: member } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!member || member.role !== 'ADMIN') {
    return { error: 'Only community administrators can change the logo or badge.' };
  }

  // 4. Upload logo to Supabase Storage using admin client
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `community-${communityId}-${Date.now()}.${ext}`;

  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: publicUrlData } = adminClient.storage.from('avatars').getPublicUrl(fileName);
  const logoUrl = publicUrlData.publicUrl;

  // 5. Update communities table logo_url column
  const { error: updateError } = await adminClient
    .from('communities')
    .update({ logo_url: logoUrl })
    .eq('id', communityId);

  if (updateError) {
    return { error: updateError.message };
  }

  if (communitySlug) {
    revalidatePath(`/c/${communitySlug}`);
  }
  revalidatePath('/', 'layout');

  return { success: true, url: logoUrl };
}

export async function updateCommunityInfoAction(input: {
  communityId: string;
  communitySlug: string;
  name?: string;
  description?: string;
  defaultSport?: string;
  bannerUrl?: string;
}): Promise<ActionResult<any>> {
  try {
    await requireCommunityAdmin(input.communityId);
    const supabase = await createClient();

    const updates: Record<string, any> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.description !== undefined) updates.description = input.description.trim();
    if (input.defaultSport !== undefined) updates.default_sport = input.defaultSport.trim();
    if (input.bannerUrl !== undefined) updates.banner_url = input.bannerUrl.trim();

    const { data, error } = await supabase
      .from('communities')
      .update(updates)
      .eq('id', input.communityId)
      .select()
      .single();

    if (error) {
      return { ok: false, code: 'UNKNOWN', message: error.message };
    }

    if (input.communitySlug) {
      revalidatePath(`/c/${input.communitySlug}`);
    }
    revalidatePath('/', 'layout');

    return { ok: true, data };
  } catch (error: any) {
    return { ok: false, code: 'FORBIDDEN', message: error.message || 'Permission denied' };
  }
}
