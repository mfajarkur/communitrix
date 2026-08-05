import { requireProfile } from '@/server/guards';
import { getMyProfileWithCommunities } from '../profile-actions';
import { getMyStatsByCommunity, getMyEloTrend } from './profile-actions';
import ProfileView from './profile-view';

export default async function ProfilePage() {
  await requireProfile();

  const [profileData, communityStats, tennisTrend, padelTrend] = await Promise.all([
    getMyProfileWithCommunities(),
    getMyStatsByCommunity(),
    getMyEloTrend('TENNIS'),
    getMyEloTrend('PADEL'),
  ]);

  if (!profileData) {
    return <div className="text-sm text-zinc-400 text-center py-12">Unable to load your profile.</div>;
  }

  return (
    <ProfileView
      profileData={profileData}
      communityStats={communityStats}
      eloTrends={{ TENNIS: tennisTrend, PADEL: padelTrend }}
    />
  );
}
