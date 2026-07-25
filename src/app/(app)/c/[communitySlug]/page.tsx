import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { notFound } from 'next/navigation';
import CommunityTabs from './community-tabs';

export const dynamic = 'force-dynamic';

export default async function CommunityDashboardPage({
  params,
}: {
  params: Promise<{ communitySlug: string }>;
}) {
  const { communitySlug } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // 1. Fetch community details
  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', communitySlug)
    .maybeSingle();

  if (!community) {
    notFound();
  }

  // 2. Fetch current caller member role
  const { data: callerMember } = await supabase
    .from('community_members')
    .select('*')
    .eq('community_id', community.id)
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!callerMember) {
    notFound();
  }

  const isAdmin = callerMember.role === 'ADMIN';

  // 3. Fetch active members list
  const { data: members } = await supabase
    .from('community_members')
    .select(`
      role,
      is_active,
      joined_at,
      profile:profiles (
        id,
        full_name,
        is_guest,
        avatar_url
      )
    `)
    .eq('community_id', community.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true });

  const activeMembers = members || [];

  // 4. Fetch rankings for default sport
  const { data: rankings } = await supabase
    .from('player_rankings')
    .select(`
      id,
      elo_rating,
      elo_peak,
      total_matches,
      total_wins,
      total_losses,
      total_draws,
      points_for,
      points_against,
      is_provisional,
      profile:profiles (
        id,
        full_name,
        is_guest
      )
    `)
    .eq('community_id', community.id)
    .eq('sport', community.default_sport)
    .order('elo_rating', { ascending: false });

  const activeRankings = rankings || [];

  // 5. Fetch sessions history
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('community_id', community.id)
    .order('created_at', { ascending: false });

  const activeSessions = sessions || [];

  // 6. Fetch stats: count active sessions
  const { count: activeSessionsCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', community.id)
    .eq('status', 'ACTIVE');

  // 7. Fetch stats: count total completed matches in the community
  const { count: totalMatchesCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', community.id)
    .eq('status', 'COMPLETED');

  return (
    <div className="space-y-6">
      {/* Tabs Switcher and Content */}
      <CommunityTabs
        communityId={community.id}
        communitySlug={communitySlug}
        communityName={community.name}
        defaultSport={community.default_sport}
        isAdmin={isAdmin}
        memberCount={activeMembers.length}
        activeSessionsCount={activeSessionsCount || 0}
        totalMatchesCount={totalMatchesCount || 0}
        sessions={activeSessions}
        members={activeMembers}
        rankings={activeRankings}
      />
    </div>
  );
}
