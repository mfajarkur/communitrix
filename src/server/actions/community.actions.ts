'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, requireCommunityAdmin } from '@/server/guards';
import { type ActionResult } from '@/server/result';
import { revalidatePath } from 'next/cache';
import { detectImageType } from '@/lib/utils/image';

export type CommunityUsage = { created: number; joined: number };

// Client-side UX sugar for the caps enforced server-side in create_community/
// join_community (migration 0035) — lets the UI show "X/3 created" chips and
// pre-empt an upgrade prompt before navigating, without being the actual
// trust boundary.
export async function getMyCommunityUsage(): Promise<CommunityUsage> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ count: created }, { count: joined }] = await Promise.all([
    supabase.from('communities').select('id', { count: 'exact', head: true }).eq('created_by', profile.id),
    supabase
      .from('community_members')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profile.id)
      .eq('is_active', true),
  ]);

  return { created: created ?? 0, joined: joined ?? 0 };
}

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
      if (error.message?.includes('creation limit reached')) {
        return {
          ok: false,
          code: 'FORBIDDEN',
          message: error.message,
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

export type JoinCommunityResult =
  | { status: 'JOINED'; community: { id: string; slug: string; name: string }; member: any }
  | { status: 'PENDING'; community: { id: string; slug: string; name: string }; request: any };

export async function joinCommunityAction(input: {
  joinCode: string;
}): Promise<ActionResult<JoinCommunityResult>> {
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

    // 3. Call the RPC request_join_community — grants membership immediately for communities
    // that haven't opted into approval, or creates a PENDING request for ones that have. The
    // caller distinguishes the two via result.status.
    const supabase = await createClient();
    const { data: result, error } = await supabase
      .rpc('request_join_community', {
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
      if (error.message?.includes('join limit reached')) {
        return {
          ok: false,
          code: 'FORBIDDEN',
          message: error.message,
        };
      }
      if (error.message?.includes('already a member')) {
        return {
          ok: false,
          code: 'CONFLICT',
          message: error.message,
        };
      }
      return {
        ok: false,
        code: 'UNKNOWN',
        message: error.message || 'An unexpected database error occurred.',
      };
    }

    return { ok: true, data: result as JoinCommunityResult };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: error.message || 'Authentication required.',
    };
  }
}

export type PublicCommunityResult = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  default_sport: string;
  member_count: number;
};

export async function searchPublicCommunitiesAction(query: string): Promise<ActionResult<PublicCommunityResult[]>> {
  try {
    await requireProfile();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('search_public_communities', { p_query: query.trim() });

    if (error) {
      return { ok: false, code: 'UNKNOWN', message: error.message || 'Search failed.' };
    }

    return { ok: true, data: (data || []) as PublicCommunityResult[] };
  } catch (error: any) {
    return { ok: false, code: 'UNAUTHENTICATED', message: error.message || 'Authentication required.' };
  }
}

// Shared join entry point for both the "Find Community" search results (public communities,
// no token) and the /join/[token] invite landing page (public or private, token required for
// private ones) — mirrors joinCommunityAction's error-mapping and JoinCommunityResult shape,
// just authorized by community id + optional invite token instead of a typed join code.
export async function requestJoinCommunityByIdAction(
  communityId: string,
  inviteToken?: string
): Promise<ActionResult<JoinCommunityResult>> {
  try {
    await requireProfile();
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('request_join_community', {
      p_community_id: communityId,
      p_invite_token: inviteToken || null,
    });

    if (error) {
      if (error.message?.includes('Community not found') || error.code === 'P0002') {
        return { ok: false, code: 'NOT_FOUND', message: 'Community not found.' };
      }
      if (error.message?.includes('Not authorized')) {
        return { ok: false, code: 'FORBIDDEN', message: 'This community is not public and this invite link is not valid for it.' };
      }
      if (error.message?.includes('join limit reached')) {
        return { ok: false, code: 'FORBIDDEN', message: error.message };
      }
      if (error.message?.includes('already a member')) {
        return { ok: false, code: 'CONFLICT', message: error.message };
      }
      return { ok: false, code: 'UNKNOWN', message: error.message || 'An unexpected database error occurred.' };
    }

    return { ok: true, data: result as JoinCommunityResult };
  } catch (error: any) {
    if (error.message?.includes('redirect')) throw error;
    return { ok: false, code: 'UNAUTHENTICATED', message: error.message || 'Authentication required.' };
  }
}

// Persists a drag-reordered community list (community-nav.tsx's reorder modal) — the switcher's
// chip order and the /c redirect route's default community both read `sort_order` off
// community_members. Goes through the reorder_communities RPC rather than a plain client update:
// the UPDATE RLS policy on community_members only allows a community ADMIN to touch a row, so a
// regular member has no column-scoped way to update even their own sort_order otherwise.
export async function reorderCommunitiesAction(orderedCommunityIds: string[]): Promise<ActionResult<null>> {
  try {
    await requireProfile();
    const supabase = await createClient();
    const { error } = await supabase.rpc('reorder_communities', { p_community_ids: orderedCommunityIds });

    if (error) {
      return { ok: false, code: 'UNKNOWN', message: error.message || 'Failed to save the new order.' };
    }

    revalidatePath('/', 'layout');
    return { ok: true, data: null };
  } catch (error: any) {
    return { ok: false, code: 'UNAUTHENTICATED', message: error.message || 'Authentication required.' };
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

  // 4. Upload logo to Supabase Storage using admin client — the stored extension/content-type
  // are derived from the file's actual signature, not the client-supplied name/MIME type
  // (both spoofable), same fix already applied to personal avatar uploads.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectImageType(bytes);
  if (!detectedType) {
    return { error: 'File must be a valid JPEG, PNG, or WEBP image' };
  }
  const contentType = detectedType === 'jpeg' ? 'image/jpeg' : `image/${detectedType}`;
  const fileName = `community-${communityId}-${Date.now()}.${detectedType === 'jpeg' ? 'jpg' : detectedType}`;

  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from('avatars')
    .upload(fileName, bytes, { upsert: true, contentType });

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

// Mirrors uploadCommunityLogoAction exactly (same ADMIN-only check, same magic-byte file
// validation, same 'avatars' storage bucket) but writes the separate avatar_url column — the
// circular profile picture shown bottom-left of the header card (community-carousel.tsx),
// distinct from logo_url (the wide header banner/"badge").
export async function uploadCommunityAvatarAction(formData: FormData) {
  const supabase = await createClient();
  const communityId = formData.get('community_id') as string;
  const communitySlug = formData.get('community_slug') as string;
  const file = formData.get('avatar') as File;

  if (!communityId || !file || file.size === 0) {
    return { error: 'Invalid parameters or file missing' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: 'File size must be under 5MB' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Authentication required' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    return { error: 'Profile not found' };
  }

  const { data: member } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!member || member.role !== 'ADMIN') {
    return { error: 'Only community administrators can change the profile picture.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectImageType(bytes);
  if (!detectedType) {
    return { error: 'File must be a valid JPEG, PNG, or WEBP image' };
  }
  const contentType = detectedType === 'jpeg' ? 'image/jpeg' : `image/${detectedType}`;
  const fileName = `community-avatar-${communityId}-${Date.now()}.${detectedType === 'jpeg' ? 'jpg' : detectedType}`;

  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from('avatars')
    .upload(fileName, bytes, { upsert: true, contentType });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: publicUrlData } = adminClient.storage.from('avatars').getPublicUrl(fileName);
  const avatarUrl = publicUrlData.publicUrl;

  const { error: updateError } = await adminClient
    .from('communities')
    .update({ avatar_url: avatarUrl })
    .eq('id', communityId);

  if (updateError) {
    return { error: updateError.message };
  }

  if (communitySlug) {
    revalidatePath(`/c/${communitySlug}`);
  }
  revalidatePath('/', 'layout');

  return { success: true, url: avatarUrl };
}

export async function updateCommunityInfoAction(input: {
  communityId: string;
  communitySlug: string;
  name?: string;
  description?: string;
  defaultSport?: string;
  cpResetPolicy?: 'never' | 'seasonal';
  requireJoinApproval?: boolean;
  isPublic?: boolean;
  regenerateInviteToken?: boolean;
}): Promise<ActionResult<any>> {
  try {
    await requireCommunityAdmin(input.communityId);

    const updates: Record<string, any> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.defaultSport !== undefined) updates.default_sport = input.defaultSport.trim();
    if (input.cpResetPolicy !== undefined) updates.cp_reset_policy = input.cpResetPolicy;
    if (input.isPublic !== undefined) updates.is_public = input.isPublic;
    if (input.regenerateInviteToken) updates.invite_token = crypto.randomUUID();

    if (input.description !== undefined) {
      updates.description = input.description.trim();
    }

    const adminClient = createAdminClient();

    // require_join_approval always lives in settings jsonb (no dedicated column) — merge it in
    // alongside whatever else is being saved, same read-then-spread pattern the description
    // fallback below uses for its own settings write.
    if (input.requireJoinApproval !== undefined) {
      const { data: currentComm } = await adminClient
        .from('communities')
        .select('settings')
        .eq('id', input.communityId)
        .maybeSingle();
      const existingSettings = currentComm?.settings && typeof currentComm.settings === 'object' ? currentComm.settings : {};
      updates.settings = { ...existingSettings, require_join_approval: input.requireJoinApproval };
    }

    let { data, error } = await adminClient
      .from('communities')
      .update(updates)
      .eq('id', input.communityId)
      .select()
      .single();

    if (error && (error.message?.includes('description') || error.code === 'PGRST204')) {
      // Fallback: If description column does not exist on remote database yet, store description inside settings JSONB!
      delete updates.description;

      const { data: currentComm } = await adminClient
        .from('communities')
        .select('settings')
        .eq('id', input.communityId)
        .maybeSingle();

      const existingSettings = currentComm?.settings && typeof currentComm.settings === 'object' ? currentComm.settings : {};
      updates.settings = {
        ...existingSettings,
        description: input.description?.trim(),
        ...(input.requireJoinApproval !== undefined ? { require_join_approval: input.requireJoinApproval } : {}),
      };

      const fallbackRes = await adminClient
        .from('communities')
        .update(updates)
        .eq('id', input.communityId)
        .select()
        .single();

      data = fallbackRes.data;
      error = fallbackRes.error;
    }

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
