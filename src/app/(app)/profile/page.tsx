import { requireProfile } from '@/server/guards';
import { getMyProfileWithCommunities } from '../profile-actions';
import { getMyStatsByCommunity, getMyEloTrend, type Sport, type EloTrend } from './profile-actions';
import ProfileView from './profile-view';

export default async function ProfilePage() {
  await requireProfile();

  const [profileData, communityStats] = await Promise.all([
    getMyProfileWithCommunities(),
    getMyStatsByCommunity(),
  ]);

  if (!profileData) {
    return <div className="text-sm text-zinc-400 text-center py-12">Unable to load your profile.</div>;
  }

  // One Elo trend per (community, sport) actually played — never merged across communities,
  // since each is its own independent rating pool (see getMyEloTrend's own comment for why).
  const trendRequests: { communityId: string; sport: Sport }[] = [];
  communityStats.forEach((c) => {
    (Object.keys(c.bySport) as Sport[]).forEach((sport) => {
      trendRequests.push({ communityId: c.communityId, sport });
    });
  });

  const trendResults = await Promise.all(
    trendRequests.map((r) => getMyEloTrend(r.sport, r.communityId))
  );

  const eloTrendsByCommunity: Record<string, Partial<Record<Sport, EloTrend>>> = {};
  trendRequests.forEach((r, i) => {
    if (!eloTrendsByCommunity[r.communityId]) eloTrendsByCommunity[r.communityId] = {};
    eloTrendsByCommunity[r.communityId][r.sport] = trendResults[i];
  });

  return (
    <ProfileView
      profileData={profileData}
      communityStats={communityStats}
      eloTrendsByCommunity={eloTrendsByCommunity}
    />
  );
}
