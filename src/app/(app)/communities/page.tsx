import { requireProfile } from '@/server/guards';
import { getMyCommunityUsage } from '@/server/actions/community.actions';
import UsageChips from './usage-chips';
import AddCommunityChooser from './add-community-chooser';

// The single membership-list-with-badges view is gone — this is now the same Create/Find
// surface the "Switch Community" button opens as a popup (community-switcher-modal.tsx), just
// full-width with no dialog chrome. Reached via direct URL, or by /c's zero-communities
// fallback; switching between communities you're already in happens via that same popup's
// quick-switch grid, not by browsing a list here.
export default async function CommunitiesPage() {
  await requireProfile();
  const usage = await getMyCommunityUsage();

  return (
    <div className="space-y-6 bg-white max-w-lg mx-auto">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">Add a Community</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Create your own, or find a public one to join.</p>
        </div>
        <UsageChips usage={usage} />
      </div>

      <AddCommunityChooser usage={usage} />
    </div>
  );
}
