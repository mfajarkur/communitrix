import Link from 'next/link';
import { ArrowLeft, Zap } from 'lucide-react';
import { requireProfile } from '@/server/guards';
import { getMyProfileWithCommunities } from '../../profile-actions';
import WizardForm from '../../c/[communitySlug]/sessions/new/wizard-form';

export default async function PersonalQuickMatchPage() {
  const profile = await requireProfile();
  const profileData = await getMyProfileWithCommunities();

  const displayName =
    profileData?.profile.display_name || profileData?.profile.full_name || 'You';
  const avatarUrl = profileData?.profile.avatar_url ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/communities"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-orange-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Profile
        </Link>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-black uppercase tracking-wider">
          <Zap className="h-3 w-3" />
          Quick Match
        </span>
      </div>

      <div className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-8 text-zinc-900 shadow-sm">
        <WizardForm
          communityId=""
          communitySlug=""
          players={[]}
          currentProfile={{ id: profile.id, name: displayName, avatarUrl }}
          isGuestDemoMode={true}
          saveToProfile={true}
        />
      </div>
    </div>
  );
}
