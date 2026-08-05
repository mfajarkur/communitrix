import { requireProfile } from '@/server/guards';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ActiveTabProvider } from './active-tab-context';
import CommunityNav from './community-nav';

export const dynamic = 'force-dynamic';

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ communitySlug: string }>;
}) {
  const { communitySlug } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // Fetch the community details
  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', communitySlug)
    .maybeSingle();

  if (!community) {
    notFound();
  }

  // Fetch current user's membership details
  const { data: member } = await supabase
    .from('community_members')
    .select('*')
    .eq('community_id', community.id)
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!member) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-6 bg-white">
        <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">Access Denied</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          You are not currently a member of this community. Find it by name if it's public, or ask an admin for an invite link.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/communities"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
          >
            Find a Community
          </Link>
        </div>
      </div>
    );
  }

  // Own communities list, for the switcher chips in CommunityNav — a separate, lighter query
  // from page.tsx's own community fetch, since this layout stays mounted across community
  // switches while page.tsx (and its heavier queries) reload underneath.
  const { data: myMemberships } = await supabase
    .from('community_members')
    .select('community:communities(id, name, slug, logo_url)')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: false });

  const myCommunities = (myMemberships || [])
    .map((m: any) => (Array.isArray(m.community) ? m.community[0] : m.community))
    .filter((c: any): c is { id: string; name: string; slug: string; logo_url: string | null } => !!c);

  const role: 'ADMIN' | 'HOST' | 'MEMBER' =
    member.role === 'ADMIN' ? 'ADMIN' : member.role === 'HOST' ? 'HOST' : 'MEMBER';
  const bannerImage = community.logo_url || '/community_banner_placeholder.png';

  return (
    <div className="bg-white">
      <ActiveTabProvider>
        <CommunityNav
          communitySlug={communitySlug}
          communityName={community.name}
          bannerImage={bannerImage}
          role={role}
          myCommunities={myCommunities}
        />
        {children}
      </ActiveTabProvider>
    </div>
  );
}
