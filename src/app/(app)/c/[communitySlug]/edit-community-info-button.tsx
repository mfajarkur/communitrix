'use client';

import { useState } from 'react';
import { Edit3, X, Loader2, Trophy } from 'lucide-react';
import { updateCommunityInfoAction } from '@/server/actions/community.actions';
import { startNewCpSeasonAction } from '@/server/actions/session.actions';

type Props = {
  communityId: string;
  communitySlug: string;
  community: {
    description?: string | null;
    settings?: { description?: string | null; require_join_approval?: boolean | null } | null;
    default_sport: string;
    cp_reset_policy?: 'never' | 'seasonal' | null;
  };
};

// Admin-only trigger + modal for community settings (description, default sport, CP reset
// policy, starting a new CP season) — lives in the top banner (layout.tsx) rather than the Home
// tab's content, since the banner is the one thing that's always visible regardless of tab.
export default function EditCommunityInfoButton({ communityId, communitySlug, community }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [editDescription, setEditDescription] = useState(
    community.description || community.settings?.description || ''
  );
  const [editSport, setEditSport] = useState(community.default_sport);
  const [editCpResetPolicy, setEditCpResetPolicy] = useState<'never' | 'seasonal'>(
    community.cp_reset_policy === 'seasonal' ? 'seasonal' : 'never'
  );
  const [editRequireJoinApproval, setEditRequireJoinApproval] = useState(
    community.settings?.require_join_approval === true
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isStartingSeason, setIsStartingSeason] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateCommunityInfoAction({
        communityId,
        communitySlug,
        description: editDescription,
        defaultSport: editSport,
        cpResetPolicy: editCpResetPolicy,
        requireJoinApproval: editRequireJoinApproval,
      });
      if (res.ok) {
        setIsOpen(false);
        window.location.reload();
      } else {
        alert(res.message || 'Failed to save community info');
      }
    } catch (err: any) {
      alert(err?.message || 'Error saving community info');
    } finally {
      setIsSaving(false);
    }
  };

  // Ends the current CP season (if any) and starts a fresh one — only meaningful once
  // cp_reset_policy is 'seasonal', since 'never' communities never look up a season at all.
  const handleStartNewSeason = async () => {
    if (
      !confirm(
        'Start a new Community Points season? This ends the current season — CP already awarded stays on the record, but the leaderboard for the new season starts from zero.'
      )
    ) {
      return;
    }
    setIsStartingSeason(true);
    try {
      const res = await startNewCpSeasonAction(communityId, communitySlug);
      if (res.ok) {
        window.location.reload();
      } else {
        alert(res.message || 'Failed to start a new CP season');
      }
    } catch (err: any) {
      alert(err?.message || 'Error starting a new CP season');
    } finally {
      setIsStartingSeason(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-white/95 hover:text-white transition-all bg-black/30 hover:bg-black/50 px-2.5 py-1 rounded-lg backdrop-blur-sm shadow-sm cursor-pointer"
      >
        <Edit3 className="h-3 w-3" />
        Edit Info
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-zinc-100 text-[#111827]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-orange-500" />
                Edit Community Info
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Community Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe your community..."
                  className="w-full p-3 bg-zinc-100 rounded-xl text-zinc-900 border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Default Sport</label>
                <select
                  value={editSport}
                  onChange={(e) => setEditSport(e.target.value)}
                  className="w-full p-3 bg-zinc-100 rounded-xl text-zinc-900 border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none font-bold"
                >
                  <option value="PADEL">PADEL</option>
                  <option value="TENNIS">TENNIS</option>
                </select>
              </div>

              <div className="pt-1 border-t border-zinc-100">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span>
                    <span className="font-bold text-zinc-700 block">Require approval to join</span>
                    <span className="text-[10px] text-zinc-400 font-medium block mt-0.5">
                      New join-code requests wait for an admin to approve them instead of joining instantly.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={editRequireJoinApproval}
                    onChange={(e) => setEditRequireJoinApproval(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-orange-500 cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-1 border-t border-zinc-100">
                <label className="font-bold text-zinc-700 block mb-1">Community Points Reset Policy</label>
                <select
                  value={editCpResetPolicy}
                  onChange={(e) => setEditCpResetPolicy(e.target.value as 'never' | 'seasonal')}
                  className="w-full p-3 bg-zinc-100 rounded-xl text-zinc-900 border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none font-bold"
                >
                  <option value="never">Never — CP accumulates for the community's lifetime</option>
                  <option value="seasonal">Seasonal — CP resets when a new season starts</option>
                </select>
                <p className="text-[10px] text-zinc-400 font-medium mt-1">
                  {editCpResetPolicy === 'seasonal'
                    ? 'Members earn CP within the current season only. Start a new season below to reset the leaderboard.'
                    : 'Members earn CP for as long as they stay in this community — no reset.'}
                </p>

                {/* Gated on the already-saved policy, not the dropdown's pending selection —
                    starting a season reloads the page, which would silently discard an
                    unsaved policy change before it's persisted. */}
                {community.cp_reset_policy === 'seasonal' && (
                  <button
                    type="button"
                    onClick={handleStartNewSeason}
                    disabled={isStartingSeason}
                    className="w-full mt-2.5 py-2 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-xs font-bold text-orange-700 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isStartingSeason ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                    Start New CP Season
                  </button>
                )}
                {editCpResetPolicy === 'seasonal' && community.cp_reset_policy !== 'seasonal' && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1.5">
                    Save this change first — the "Start New Season" button appears here once Seasonal is active.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
