import { redirect } from 'next/navigation';
import { requireProfile } from '@/server/guards';
import { createClient } from '@/lib/supabase/server';

// The top nav's "Community" tab points here instead of straight at /communities (the list) —
// jump the user directly into their default community, i.e. whichever one is first in their
// drag-reordered order (sort_order, migration 0040, set via reorder-communities-modal.tsx).
// Falls back to the list page itself if they're not in any community at all.
export default async function CommunityRedirectPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from('community_members')
    .select('community:communities(slug)')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1);

  const defaultSlug = memberships?.[0]
    ? Array.isArray((memberships[0] as any).community)
      ? (memberships[0] as any).community[0]?.slug
      : (memberships[0] as any).community?.slug
    : null;

  if (!defaultSlug) {
    redirect('/communities');
  }

  redirect(`/c/${defaultSlug}`);
}
