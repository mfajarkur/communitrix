import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/server/guards';
import { notFound } from 'next/navigation';
import CommunityTabs from './community-tabs';

export const dynamic = 'force-dynamic';

// The Supabase client here isn't parameterized with generated Database types (none exist in
// this project — see src/lib/supabase/{client,server}.ts), so postgrest-js can't tell a to-one
// embedded relation (community_members -> profiles) from a to-many one and infers `profile` as
// an array. These mirror the actual shape of the `profile:profiles(...)` embeds selected below.
interface MemberProfileRow {
  id: string;
  full_name: string | null;
  display_name: string | null;
  username: string | null;
  gender: string | null;
  is_guest: boolean;
  avatar_url: string | null;
}
interface ActiveMemberRow {
  role: string;
  is_active: boolean;
  joined_at: string;
  profile: MemberProfileRow | null;
}
interface RankingRow {
  id: string;
  profile_id: string;
  sport: string;
  elo_rating: number;
  elo_peak: number;
  total_matches: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
  points_for: number;
  points_against: number;
  is_provisional: boolean;
  profile: MemberProfileRow | null;
}

export default async function CommunityDashboardPage({
  params,
}: {
  params: Promise<{ communitySlug: string }>;
}) {
  const { communitySlug } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // 1. Fetch community details — everything below needs community.id, so this has to resolve
  // first.
  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', communitySlug)
    .maybeSingle();

  if (!community) {
    notFound();
  }

  // 2. Fetch current caller member role — also has to resolve first, since whether the caller is
  // an admin decides which of the queries below even run.
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
  const isHostOrAdmin = callerMember.role === 'ADMIN' || callerMember.role === 'HOST';

  // 3. Everything else only depends on community.id/profile.id/isAdmin, all already known —
  // fired as one batch instead of one-after-another (was 11 sequential round-trips here alone,
  // each paying full network latency; this page's slow load was that, not "a lot of content").
  const emptyRows = Promise.resolve({ data: [] as any[] });

  const [
    { data: members },
    { data: allRankings },
    { data: cpData },
    { data: sessions },
    { count: activeSessionsCount },
    { count: totalMatchesCount },
    { data: claimsData },
    { data: joinRequestsData },
    { data: myClaimsData },
  ] = await Promise.all([
    // Active members list
    adminClient
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
          gender,
          is_guest,
          avatar_url
        )
      `)
      .eq('community_id', community.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true }),

    // All player rankings for this community (PADEL and TENNIS)
    adminClient
      .from('player_rankings')
      .select(`
        id,
        profile_id,
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
        profile:profiles (
          id,
          full_name,
          display_name,
          username,
          gender,
          is_guest,
          avatar_url
        )
      `)
      .eq('community_id', community.id)
      .order('elo_rating', { ascending: false }),

    // Total CP per player for this community
    supabase.from('community_points').select('profile_id, points_awarded').eq('community_id', community.id),

    // Sessions history
    supabase
      .from('sessions')
      .select('*, session_players(id, status)')
      .eq('community_id', community.id)
      .order('created_at', { ascending: false }),

    // Stats: count active sessions
    supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'ACTIVE'),

    // Stats: count total completed matches in the community
    supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'COMPLETED'),

    // Pending claim requests (Admin only)
    isAdmin
      ? supabase
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
          .order('created_at', { ascending: false })
      : emptyRows,

    // Pending join requests (Admin only)
    isAdmin
      ? supabase
          .from('community_join_requests')
          .select(`
            id,
            created_at,
            profile:profiles!community_join_requests_profile_id_fkey (
              id,
              full_name,
              display_name,
              username,
              avatar_url
            )
          `)
          .eq('community_id', community.id)
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
      : emptyRows,

    // Current user's own pending claim requests in this community
    supabase
      .from('guest_claim_requests')
      .select('guest_profile_id, status')
      .eq('community_id', community.id)
      .eq('requester_profile_id', profile.id)
      .eq('status', 'PENDING'),
  ]);

  const activeMembers = (members || []) as unknown as ActiveMemberRow[];
  const rawRankings = (allRankings || []) as unknown as RankingRow[];

  const buildLeaderboard = (sportName: string) => {
    const sportRankings = rawRankings.filter((r) => r.sport === sportName);
    const map = new Map(sportRankings.map((r) => [r.profile_id || r.profile?.id, r]));

    return activeMembers
      .filter((m): m is ActiveMemberRow & { profile: MemberProfileRow } => m.profile !== null)
      .map((m) => {
        const existing = map.get(m.profile.id);
        if (existing) {
          return {
            ...existing,
            profile: existing.profile || m.profile,
          };
        }
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

  const cpMap: Record<string, number> = {};
  (cpData || []).forEach((row: any) => {
    cpMap[row.profile_id] = (cpMap[row.profile_id] || 0) + Number(row.points_awarded || 0);
  });

  const activeSessions = sessions || [];
  const pendingClaims = claimsData || [];
  const pendingJoinRequests = joinRequestsData || [];
  const myClaimedGuestIds = (myClaimsData || []).map((c: any) => c.guest_profile_id);

  return (
    <div className="space-y-6">
      {/* Tabs Switcher and Content */}
      <CommunityTabs
        community={community}
        communityId={community.id}
        communitySlug={communitySlug}
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
        pendingJoinRequests={pendingJoinRequests}
      />
    </div>
  );
}
