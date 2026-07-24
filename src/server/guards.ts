import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect('/login');
  }
  return user;
}

export async function requireProfile() {
  const user = await requireUser();
  const supabase = await createClient();
  
  // Try to find the profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (profile) {
    return profile;
  }

  // Frictionless onboarding helper: Auto-create a profile if it's missing (useful before onboarding UI is built)
  const defaultName = user.email ? user.email.split('@')[0] : 'User';
  const { data: newProfile, error: createError } = await supabase
    .from('profiles')
    .insert({
      auth_user_id: user.id,
      full_name: defaultName,
    })
    .select('*')
    .single();

  if (createError || !newProfile) {
    throw new Error('Failed to retrieve or create user profile');
  }

  return newProfile;
}

export async function requireMember(communityId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: isMember, error } = await supabase
    .rpc('is_community_member', { cid: communityId });

  if (error || !isMember) {
    throw new Error('Forbidden: You are not an active member of this community');
  }

  return profile;
}

export async function requireCommunityAdmin(communityId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: isAdmin, error } = await supabase
    .rpc('is_community_admin', { cid: communityId });

  if (error || !isAdmin) {
    throw new Error('Forbidden: You are not an administrator of this community');
  }

  return profile;
}
