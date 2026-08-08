'use client';

import { useState } from 'react';
import { Edit3, X, Loader2, Trophy, Copy, Check, RefreshCw, Settings, Shield, Activity, Users, FileText } from 'lucide-react';
import { updateCommunityInfoAction } from '@/server/actions/community.actions';
import { startNewCpSeasonAction } from '@/server/actions/session.actions';
import ConfirmModal from '@/components/ui/confirm-modal';

type Props = {
  communityId: string;
  communitySlug: string;
  community: {
    description?: string | null;
    settings?: { description?: string | null; require_join_approval?: boolean | null } | null;
    default_sport: string;
    cp_reset_policy?: 'never' | 'seasonal' | null;
    is_public?: boolean | null;
    invite_token?: string | null;
  };
};

// Admin-only trigger + modal for community settings (description, default sport, CP reset
// policy, starting a new CP season) — lives in the top banner (layout.tsx) rather than the Home
// tab's content, since the banner is the one thing that's always visible regardless of tab.
export default function EditCommunityInfoButton({ communityId, communitySlug, community }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');
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
  const [editIsPublic, setEditIsPublic] = useState(community.is_public === true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStartingSeason, setIsStartingSeason] = useState(false);
  const [isRegeneratingLink, setIsRegeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviteToken, setInviteToken] = useState(community.invite_token || '');
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [confirmNewSeasonOpen, setConfirmNewSeasonOpen] = useState(false);

  const inviteLink = typeof window !== 'undefined' && inviteToken ? `${window.location.origin}/join/${inviteToken}` : '';

  const handleCopyInviteLink = () => {
    if (!inviteLink || typeof navigator === 'undefined') return;
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleRegenerateLink = async () => {
    setConfirmRegenerateOpen(false);
    setIsRegeneratingLink(true);
    try {
      const res = await updateCommunityInfoAction({
        communityId,
        communitySlug,
        regenerateInviteToken: true,
      });
      if (res.ok) {
        setInviteToken(res.data.invite_token);
      } else {
        alert(res.message || 'Failed to regenerate invite link');
      }
    } catch (err: any) {
      alert(err?.message || 'Error regenerating invite link');
    } finally {
      setIsRegeneratingLink(false);
    }
  };

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
        isPublic: editIsPublic,
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
    setConfirmNewSeasonOpen(false);
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
        title="Community Settings"
        className="shrink-0 h-8 w-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-all cursor-pointer flex items-center justify-center shadow-xs border border-zinc-200"
      >
        <Settings className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-0 shadow-2xl overflow-hidden border border-zinc-100 text-[#111827] flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-zinc-100 p-6 pb-4 bg-zinc-50">
              <h3 className="font-black text-lg text-zinc-900 flex items-center gap-2 tracking-tight">
                <Settings className="h-5 w-5 text-zinc-700" />
                Community Settings
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-full hover:bg-zinc-200 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* TABS */}
            <div className="flex px-6 pt-2 gap-4 border-b border-zinc-100 bg-zinc-50">
              <button
                onClick={() => setActiveTab('general')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === 'general' ? 'border-orange-500 text-orange-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> General
                </div>
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === 'advanced' ? 'border-orange-500 text-orange-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Advanced
                </div>
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 text-xs">
              {activeTab === 'general' && (
                <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-zinc-700">Community Description</label>
                  <span className="text-[10px] text-zinc-400 font-medium">{editDescription.length}/160</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={160}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="A short bio for your community — shown right below the header, like an Instagram bio."
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

              </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-5 animate-in slide-in-from-left-2 duration-300">
                  <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span>
                        <span className="font-bold text-zinc-800 block flex items-center gap-1.5"><Shield className="h-4 w-4 text-orange-500"/> Require approval to join</span>
                        <span className="text-[10px] text-zinc-500 font-medium block mt-1 leading-relaxed">
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

                  <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span>
                        <span className="font-bold text-zinc-800 block flex items-center gap-1.5"><Users className="h-4 w-4 text-emerald-500"/> Community Visibility</span>
                        <span className="text-[10px] text-zinc-500 font-medium block mt-1 leading-relaxed">
                          {editIsPublic
                            ? 'Public — anyone can find this community by searching its name.'
                            : 'Private — only joinable via the invite link below.'}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={editIsPublic}
                        onChange={(e) => setEditIsPublic(e.target.checked)}
                        className="h-5 w-5 shrink-0 accent-orange-500 cursor-pointer"
                      />
                    </label>
                  </div>

              <div className="bg-amber-50/50 border border-amber-100/60 p-4 rounded-2xl">
                <label className="font-bold text-amber-900 block mb-2 flex items-center gap-1.5"><Trophy className="h-4 w-4 text-amber-500"/> Community Points Reset Policy</label>
                <select
                  value={editCpResetPolicy}
                  onChange={(e) => setEditCpResetPolicy(e.target.value as 'never' | 'seasonal')}
                  className="w-full p-3 bg-white rounded-xl text-amber-900 border border-amber-200 focus:border-orange-500 focus:outline-none font-bold"
                >
                  <option value="never">Never — CP accumulates forever</option>
                  <option value="seasonal">Seasonal — CP resets per season</option>
                </select>
                <p className="text-[10px] text-amber-700/80 font-medium mt-2 leading-relaxed">
                  {editCpResetPolicy === 'seasonal'
                    ? 'Members earn CP within the current season only. Start a new season below to reset the leaderboard.'
                    : 'Members earn CP for as long as they stay in this community — no reset.'}
                </p>

                {/* Gated on the already-saved policy */}
                {community.cp_reset_policy === 'seasonal' && (
                  <button
                    type="button"
                    onClick={() => setConfirmNewSeasonOpen(true)}
                    disabled={isStartingSeason}
                    className="w-full mt-3 py-2.5 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-xs font-bold text-orange-700 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isStartingSeason ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                    Start New CP Season
                  </button>
                )}
                {editCpResetPolicy === 'seasonal' && community.cp_reset_policy !== 'seasonal' && (
                  <p className="text-[10px] text-orange-600 font-bold mt-2 bg-orange-100/50 p-2 rounded-lg border border-orange-200/50">
                    Save this change first — the "Start New Season" button appears here once Seasonal is active.
                  </p>
                )}
              </div>
              
              </div>
              )}
            </div>

            <div className="flex items-center gap-3 p-6 pt-4 border-t border-zinc-100 bg-zinc-50">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-black text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmRegenerateOpen}
        icon={RefreshCw}
        title="Regenerate Invite Link?"
        message="The old link will stop working immediately."
        confirmLabel="Yes, Regenerate"
        isConfirming={isRegeneratingLink}
        onConfirm={handleRegenerateLink}
        onCancel={() => setConfirmRegenerateOpen(false)}
      />

      <ConfirmModal
        open={confirmNewSeasonOpen}
        icon={Trophy}
        title="Start New CP Season?"
        message="This ends the current season — CP already awarded stays on the record, but the leaderboard for the new season starts from zero."
        confirmLabel="Yes, Start New Season"
        isConfirming={isStartingSeason}
        onConfirm={handleStartNewSeason}
        onCancel={() => setConfirmNewSeasonOpen(false)}
      />
    </>
  );
}
