import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireProfile } from '@/server/guards';
import { createClient } from '@/lib/supabase/server';
import { LAST_COMMUNITY_COOKIE } from '@/lib/constants';

// The bottom nav's "Community" tab now points here instead of straight at /communities (the
// list) — jump the user directly into a community, remembering whichever one they looked at
// last (see community-tabs.tsx's cookie-write effect) so repeat taps land somewhere useful
// instead of always defaulting to the same one. Falls back to the most recently joined
// community if there's no cookie yet (or it points at a community they've since left), and to
// the list page itself if they're not in any community at all.
export default async function CommunityRedirectPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from('community_members')
    .select('joined_at, community:communities(slug)')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: false });

  const slugs = (memberships || [])
    .map((m: any) => (Array.isArray(m.community) ? m.community[0]?.slug : m.community?.slug))
    .filter((slug): slug is string => !!slug);

  if (slugs.length === 0) {
    redirect('/communities');
  }

  const cookieStore = await cookies();
  const lastSlug = cookieStore.get(LAST_COMMUNITY_COOKIE)?.value;
  const target = lastSlug && slugs.includes(lastSlug) ? lastSlug : slugs[0];

  redirect(`/c/${target}`);
}
