import Link from 'next/link';
import { ArrowLeft, Zap, AlertCircle } from 'lucide-react';
import { requireProfile } from '@/server/guards';
import { getMyProfileWithCommunities } from '../../profile-actions';
import { getQuickMatchById } from '@/server/actions/personal-match.actions';
import WizardForm, { type GameConfiguration } from '../../c/[communitySlug]/sessions/new/wizard-form';

export default async function PersonalQuickMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const profile = await requireProfile();
  const { resume } = await searchParams;

  const [profileData, existing] = await Promise.all([
    getMyProfileWithCommunities(),
    resume ? getQuickMatchById(resume) : Promise.resolve(null),
  ]);

  const displayName =
    profileData?.profile.display_name || profileData?.profile.full_name || 'You';
  const avatarUrl = profileData?.profile.avatar_url ?? null;

  const initialState =
    existing && existing.status === 'OPEN'
      ? {
          matchId: existing.id,
          version: existing.version,
          config: existing.config as unknown as GameConfiguration,
          registeredPlayers: existing.players,
          matches: existing.matches,
          roundSitOuts: existing.round_sit_outs,
          selectedRound: existing.matches.reduce((acc, m) => Math.max(acc, m.roundNumber || 1), 1),
        }
      : undefined;

  // resume was given but there's nothing OPEN to resume (already ended, not found, or not
  // owned by this user) — say so instead of silently dropping into a blank new match.
  const resumeFailed = Boolean(resume) && !initialState;

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

      {resumeFailed && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-medium text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            That match couldn&apos;t be resumed (it may have already ended). Starting a new one below.
          </span>
        </div>
      )}

      <div className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-8 text-zinc-900 shadow-sm">
        <WizardForm
          communityId=""
          communitySlug=""
          players={[]}
          currentProfile={{ id: profile.id, name: displayName, avatarUrl }}
          isGuestDemoMode={true}
          saveToProfile={true}
          initialState={initialState}
        />
      </div>
    </div>
  );
}
