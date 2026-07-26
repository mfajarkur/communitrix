'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ProfileWithCommunities = {
  profile: {
    id: string;
    full_name: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  communities: Array<{
    id: string;
    name: string;
    slug: string;
    sport: string;
    role: string;
    joined_at: string;
  }> | null;
};

export async function getMyProfileWithCommunities(): Promise<ProfileWithCommunities | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_my_profile_with_communities');
  if (error || !data) return null;
  return data as ProfileWithCommunities;
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const displayName = formData.get('display_name') as string | null;
  const username = formData.get('username') as string | null;
  const avatarUrl = formData.get('avatar_url') as string | null;

  const { error } = await supabase.rpc('update_my_profile', {
    p_display_name: displayName || null,
    p_username: username?.toLowerCase() || null,
    p_avatar_url: avatarUrl || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('check_username_available', {
    p_username: username.toLowerCase(),
  });
  if (error) return false;
  return data as boolean;
}

export async function uploadAvatar(formData: FormData): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const file = formData.get('avatar') as File;
  if (!file || file.size === 0) return { error: 'No file provided' };
  if (file.size > 2 * 1024 * 1024) return { error: 'File size must be under 2MB' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return { url: data.publicUrl };
}
