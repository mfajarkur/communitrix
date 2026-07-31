'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/server/guards';

export type ProfileWithCommunities = {
  profile: {
    id: string;
    full_name: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    gender: 'MALE' | 'FEMALE' | null;
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

export type StatsHighlights = {
  totalMatches: number;
  totalWins: number;
  winRate: number | null;
  peakElo: number | null;
  communitiesCount: number;
  sportsPlayed: string[];
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

// Sniffs the actual file signature instead of trusting the client-supplied MIME type or
// filename extension (both are trivially spoofable) — the stored extension/content-type
// below are derived entirely from this, not from anything the client claims.
function detectImageType(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp';
  return null;
}

export async function uploadAvatar(formData: FormData): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const file = formData.get('avatar') as File;
  if (!file || file.size === 0) return { error: 'No file provided' };
  if (file.size > 2 * 1024 * 1024) return { error: 'File size must be under 2MB' };

  // Verify user is authenticated first
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectImageType(bytes);
  if (!detectedType) return { error: 'File must be a valid JPEG, PNG, or WEBP image' };

  const contentType = detectedType === 'jpeg' ? 'image/jpeg' : `image/${detectedType}`;
  const fileName = `${user.id}-${Date.now()}.${detectedType === 'jpeg' ? 'jpg' : detectedType}`;

  // Use admin client to bypass RLS for storage upload
  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from('avatars')
    .upload(fileName, bytes, { upsert: true, contentType });

  if (uploadError) return { error: uploadError.message };

  const { data } = adminClient.storage.from('avatars').getPublicUrl(fileName);
  return { url: data.publicUrl };
}

export async function updatePasswordAction(password: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updateGenderAction(gender: 'MALE' | 'FEMALE'): Promise<{ error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  // profiles_update_self RLS policy already allows a user to update their own row directly.
  const { error } = await supabase.from('profiles').update({ gender }).eq('id', profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return {};
}

export async function getMyStatsHighlights(): Promise<StatsHighlights> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: rankings } = await supabase
    .from('player_rankings')
    .select('community_id, sport, total_matches, total_wins, elo_peak')
    .eq('profile_id', profile.id);

  const rows = rankings || [];

  const totalMatches = rows.reduce((sum, r) => sum + (r.total_matches || 0), 0);
  const totalWins = rows.reduce((sum, r) => sum + (r.total_wins || 0), 0);
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 1000) / 10 : null;
  const peakElo = rows.length > 0 ? Math.max(...rows.map((r) => Number(r.elo_peak) || 0)) : null;
  const communitiesCount = new Set(rows.map((r) => r.community_id)).size;
  const sportsPlayed = Array.from(new Set(rows.map((r) => r.sport)));

  return { totalMatches, totalWins, winRate, peakElo, communitiesCount, sportsPlayed };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
