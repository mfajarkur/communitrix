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
  const { data: members } = await adminClient
    .from('community_members')
    .select(`
      role,
      is_active,
      joined_at,
      profile:profiles (
        id,
        full_name,
        display_name,
        username,
        is_guest,
        avatar_url
      )
    `)
    .eq('community_id', community.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true });

  const activeMembers = members || [];

  // 4. Fetch all player rankings for this community (PADEL and TENNIS)
  const adminClient = createAdminClient();
  const { data: allRankings } = await adminClient
    .from('player_rankings')
    .select(`
      id,
      sport,
      elo_rating,
      elo_peak,
      total_matches,
      total_wins,
      total_losses,
      total_draws,
      points_for,
      points_against,
      is_provisional,
      skill_rating_official,
      profile:profiles (
        id,
        full_name,
        display_name,
        username,
        is_guest,
        avatar_url
      )
    `)
    .eq('community_id', community.id)
    .order('elo_rating', { ascending: false });

  const rawRankings = allRankings || [];

  const buildLeaderboard = (sportName: string) => {
    const sportRankings = rawRankings.filter((r) => r.sport === sportName);
    const map = new Map(sportRankings.map((r) => [r.profile?.id, r]));

    return activeMembers
      .filter((m) => m.profile)
      .map((m) => {
        const existing = map.get(m.profile.id);
        if (existing) return existing;
        return {
          id: `default-${sportName}-${m.profile.id}`,
          sport: sportName,
          elo_rating: 1000,
          elo_peak: 1000,
          total_matches: 0,
          total_wins: 0,
          total_losses: 0,
          total_draws: 0,
          points_for: 0,
          points_against: 0,
          is_provisional: true,
          skill_rating_official: 1.0,
          profile: m.profile,
        };
      })
      .sort((a, b) => {
        if (b.elo_rating !== a.elo_rating) {
          return Number(b.elo_rating) - Number(a.elo_rating);
        }
        const nameA = a.profile?.display_name || a.profile?.full_name || '';
        const nameB = b.profile?.display_name || b.profile?.full_name || '';
        return nameA.localeCompare(nameB);
      });
  };

  const padelLeaderboard = buildLeaderboard('PADEL');
  const tennisLeaderboard = buildLeaderboard('TENNIS');
  const rankingsBySport = {
    PADEL: padelLeaderboard,
    TENNIS: tennisLeaderboard,
  };

  // Fetch total CP per player for this community
  const { data: cpData } = await supabase
    .from('community_points')
    .select('profile_id, points_awarded')
    .eq('community_id', community.id);

  const cpMap: Record<string, number> = {};
  (cpData || []).forEach((row) => {
    cpMap[row.profile_id] = (cpMap[row.profile_id] || 0) + Number(row.points_awarded || 0);
  });

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

  // 8. Fetch pending claim requests for this community (Admin Only)
  const isHostOrAdmin = callerMember.role === 'ADMIN' || callerMember.role === 'HOST';
  let pendingClaims: any[] = [];
  if (isAdmin) {
    const { data: claimsData } = await supabase
      .from('guest_claim_requests')
      .select(`
        id,
        created_at,
        guest_profile:profiles!guest_claim_requests_guest_profile_id_fkey (
          id,
          full_name,
          display_name
        ),
        requester_profile:profiles!guest_claim_requests_requester_profile_id_fkey (
          id,
          full_name,
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('community_id', community.id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    pendingClaims = claimsData || [];
  }

  // 9. Fetch current user's claim requests in this community
  const { data: myClaimsData } = await supabase
    .from('guest_claim_requests')
    .select('guest_profile_id, status')
    .eq('community_id', community.id)
    .eq('requester_profile_id', profile.id)
    .eq('status', 'PENDING');

  const myClaimedGuestIds = (myClaimsData || []).map((c) => c.guest_profile_id);

  return (
    <div className="space-y-6">
      {/* Tabs Switcher and Content */}
      <CommunityTabs
        community={community}
        communityId={community.id}
        communitySlug={communitySlug}
        communityName={community.name}
        defaultSport={community.default_sport}
        isAdmin={isAdmin}
        isHostOrAdmin={isHostOrAdmin}
        memberCount={activeMembers.length}
        activeSessionsCount={activeSessionsCount || 0}
        totalMatchesCount={totalMatchesCount || 0}
        sessions={activeSessions}
        members={activeMembers}
        rankings={padelLeaderboard}
        rankingsBySport={rankingsBySport}
        cpMap={cpMap}
        pendingClaims={pendingClaims}
        myClaimedGuestIds={myClaimedGuestIds}
        callerProfile={profile}
      />
    </div>
  );
}
