'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDisplayName, getAvatarUrl } from '@/lib/utils/profile';
import { VerifiedBadge, isProfileVerified } from '@/components/ui/verified-badge';
import { resolveJoinRequestAction } from '@/server/actions/join-request.actions';
import { removeMemberAction } from '@/server/actions/member.actions';
import { adminMergeGuestAccountAction } from '@/server/actions/claim.actions';
import {
  X,
  UserCheck,
  UserMinus,
  GitMerge,
  UserPlus,
  Search,
  CheckCircle,
  Loader2,
  AlertCircle,
  Shield,
} from 'lucide-react';

interface ManagingMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  communitySlug: string;
  members: any[];
  pendingJoinRequests: any[];
  callerProfileId?: string;
}

export default function ManagingMembersModal({
  isOpen,
  onClose,
  communityId,
  communitySlug,
  members,
  pendingJoinRequests,
  callerProfileId,
}: ManagingMembersModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'join' | 'remove' | 'merge'>('join');

  // Join Requests state
  const [processingJoinId, setProcessingJoinId] = useState<string | null>(null);

  // Remove Member state
  const [removeSearch, setRemoveSearch] = useState('');
  const [processingRemoveId, setProcessingRemoveId] = useState<string | null>(null);

  // Merge Accounts state
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeSuccess, setMergeSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter guest members vs verified members for merge
  const guestMembers = members.filter((m) => m.profile?.is_guest === true);
  const verifiedMembers = members.filter(
    (m) => !m.profile?.is_guest && m.profile?.id !== selectedGuestId
  );

  // Filter members for removal
  const removableMembers = members.filter((m) => {
    const p = m.profile;
    if (!p || p.id === callerProfileId) return false;
    if (!removeSearch.trim()) return true;
    const name = getDisplayName(p).toLowerCase();
    return name.includes(removeSearch.toLowerCase());
  });

  const handleResolveJoin = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setProcessingJoinId(requestId);
    try {
      const res = await resolveJoinRequestAction(requestId, action, communitySlug, communityId);
      if (res?.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update join request');
    } finally {
      setProcessingJoinId(null);
    }
  };

  const handleRemoveMember = async (targetProfileId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this community?`)) return;
    setProcessingRemoveId(targetProfileId);
    try {
      const res = await removeMemberAction({
        communityId,
        targetProfileId,
        communitySlug,
      });
      if (!res.ok) {
        alert(res.message || 'Failed to remove member');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to remove member');
    } finally {
      setProcessingRemoveId(null);
    }
  };

  const handleMergeSubmit = async () => {
    if (!selectedGuestId || !selectedTargetId) {
      setMergeError('Please select both a guest profile and a verified target profile');
      return;
    }
    setIsMerging(true);
    setMergeError(null);
    setMergeSuccess(null);

    try {
      const res = await adminMergeGuestAccountAction({
        guestProfileId: selectedGuestId,
        targetProfileId: selectedTargetId,
        communityId,
        communitySlug,
      });

      if (res.error) {
        setMergeError(res.error);
      } else {
        const guestName = getDisplayName(guestMembers.find((g) => g.profile?.id === selectedGuestId)?.profile);
        const targetName = getDisplayName(verifiedMembers.find((v) => v.profile?.id === selectedTargetId)?.profile);

        setMergeSuccess(`Successfully merged stats from "${guestName}" into "${targetName}"!`);
        setSelectedGuestId('');
        setSelectedTargetId('');
        router.refresh();
      }
    } catch (err: any) {
      setMergeError(err?.message || 'Failed to merge accounts');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-xl space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900">Managing Members</h2>
              <p className="text-[11px] text-zinc-500 font-medium">Community Admin Control Panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex p-1 bg-zinc-100 rounded-2xl border border-zinc-200/60">
          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'join'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Join Requests</span>
            {pendingJoinRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-white text-[9px] font-black">
                {pendingJoinRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('remove')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'remove'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <UserMinus className="h-3.5 w-3.5 text-red-500" />
            <span>Remove</span>
          </button>

          <button
            onClick={() => setActiveTab('merge')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'merge'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <GitMerge className="h-3.5 w-3.5 text-blue-500" />
            <span>Merge Accounts</span>
          </button>
        </div>

        {/* TAB 1: JOIN REQUESTS */}
        {activeTab === 'join' && (
          <div className="space-y-3">
            {pendingJoinRequests.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <UserCheck className="h-8 w-8 text-zinc-300 mx-auto" />
                <p className="text-xs text-zinc-400 font-medium">No pending join requests.</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                {pendingJoinRequests.map((req) => {
                  const p = req.profile;
                  const reqName = getDisplayName(p);
                  const isProcessing = processingJoinId === req.id;

                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getAvatarUrl(p)}
                          alt={reqName}
                          className="h-10 w-10 rounded-full object-cover shrink-0 border border-zinc-200"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-zinc-900 truncate flex items-center gap-1">
                            <span>{reqName}</span>
                            {isProfileVerified(p) && <VerifiedBadge className="h-3.5 w-3.5" />}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-medium">Wants to join community</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleResolveJoin(req.id, 'APPROVE')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                        >
                          {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleResolveJoin(req.id, 'REJECT')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REMOVE MEMBER */}
        {activeTab === 'remove' && (() => {
          const allSelected =
            removableMembers.length > 0 &&
            removableMembers.every((m) => m.profile && selectedRemoveIds.has(m.profile.id));

          const handleToggleSelectAll = () => {
            if (allSelected) {
              setSelectedRemoveIds(new Set());
            } else {
              const allIds = new Set(removableMembers.map((m) => m.profile.id).filter(Boolean));
              setSelectedRemoveIds(allIds);
            }
          };

          const handleBatchRemove = async () => {
            const count = selectedRemoveIds.size;
            if (count === 0) return;
            if (!confirm(`Are you sure you want to remove ${count} selected member${count > 1 ? 's' : ''} from this community?`)) return;

            setIsBatchRemoving(true);
            const failures: string[] = [];
            for (const targetProfileId of selectedRemoveIds) {
              try {
                const result = await removeMemberAction({ communityId, targetProfileId, communitySlug });
                if (!result.ok) failures.push(result.message || 'Unknown error');
              } catch (err: any) {
                failures.push(err?.message || 'Unknown error');
              }
            }
            setIsBatchRemoving(false);

            if (failures.length > 0) {
              alert(`Removed ${count - failures.length} of ${count} members.\n\nFailed:\n${failures.join('\n')}`);
            }
            setSelectedRemoveIds(new Set());
            router.refresh();
          };

          return (
            <div className="space-y-3">
              {/* Controls Header: Search, Select All, and Batch Remove */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search member to remove..."
                    value={removeSearch}
                    onChange={(e) => setRemoveSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-100 text-xs font-semibold rounded-xl border border-transparent focus:border-red-500 focus:bg-white focus:outline-none"
                  />
                </div>
                {removableMembers.length > 0 && (
                  <button
                    onClick={handleToggleSelectAll}
                    className="px-2.5 py-2 text-[11px] font-bold text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:bg-zinc-50 rounded-xl transition-all whitespace-nowrap cursor-pointer"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {selectedRemoveIds.size > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-red-50 border border-red-200">
                  <span className="text-xs font-extrabold text-red-900">
                    {selectedRemoveIds.size} member{selectedRemoveIds.size > 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={handleBatchRemove}
                    disabled={isBatchRemoving}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isBatchRemoving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserMinus className="h-3.5 w-3.5" />
                    )}
                    <span>Remove Selected ({selectedRemoveIds.size})</span>
                  </button>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {removableMembers.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-6 text-center">No members found.</p>
                ) : (
                  removableMembers.map((m) => {
                    const p = m.profile;
                    if (!p) return null;
                    const pName = getDisplayName(p);
                    const isProcessing = processingRemoveId === p.id;
                    const isSelected = selectedRemoveIds.has(p.id);

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedRemoveIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          });
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-red-50/70 border-red-300 shadow-2xs'
                            : 'bg-zinc-50 border-zinc-200/60 hover:bg-zinc-100/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by row click
                            className="h-4 w-4 rounded text-red-600 focus:ring-red-500 cursor-pointer accent-red-600"
                          />
                          <img
                            src={getAvatarUrl(p)}
                            alt={pName}
                            className="h-8 w-8 rounded-full object-cover shrink-0 border border-zinc-200"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-zinc-900 truncate flex items-center gap-1">
                              <span>{pName}</span>
                              {isProfileVerified(p) && <VerifiedBadge className="h-3.5 w-3.5" />}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-medium capitalize">{m.role.toLowerCase()}</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMember(p.id, pName);
                          }}
                          disabled={isProcessing}
                          className="px-2.5 py-1 rounded-xl bg-red-100/80 hover:bg-red-200 text-red-700 text-[11px] font-extrabold transition-all disabled:opacity-50 cursor-pointer border border-red-200 shrink-0"
                        >
                          {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 3: MERGE ACCOUNTS */}
        {activeTab === 'merge' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-xs text-blue-900 space-y-1">
              <p className="font-extrabold flex items-center gap-1 text-blue-900">
                <GitMerge className="h-4 w-4 text-blue-600" />
                Merge Account Data
              </p>
              <p className="text-[11px] text-blue-700 leading-normal">
                Select a guest account to merge into a verified user account. All stats, ratings, and match history will be transferred to the verified account, and the guest profile will be deleted.
              </p>
            </div>

            {mergeError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{mergeError}</span>
              </div>
            )}

            {mergeSuccess && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs font-bold text-green-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{mergeSuccess}</span>
              </div>
            )}

            {/* Step 1: Select Guest Account */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider">
                1. Select Unverified / Guest Profile:
              </label>
              <select
                value={selectedGuestId}
                onChange={(e) => setSelectedGuestId(e.target.value)}
                className="w-full p-2.5 bg-zinc-100 text-xs font-bold rounded-xl border border-zinc-200 focus:bg-white focus:border-orange-500 focus:outline-none cursor-pointer"
              >
                <option value="">-- Choose Guest Account --</option>
                {guestMembers.map((m) => (
                  <option key={m.profile?.id} value={m.profile?.id}>
                    {getDisplayName(m.profile)} (Guest)
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Select Verified Account */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider">
                2. Select Verified User Account (Target):
              </label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full p-2.5 bg-zinc-100 text-xs font-bold rounded-xl border border-zinc-200 focus:bg-white focus:border-orange-500 focus:outline-none cursor-pointer"
              >
                <option value="">-- Choose Verified User Account --</option>
                {verifiedMembers.map((m) => (
                  <option key={m.profile?.id} value={m.profile?.id}>
                    {getDisplayName(m.profile)} (Verified)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleMergeSubmit}
              disabled={!selectedGuestId || !selectedTargetId || isMerging}
              className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isMerging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Merging Accounts...</span>
                </>
              ) : (
                <>
                  <GitMerge className="h-4 w-4" />
                  <span>Link & Merge Accounts</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-zinc-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-extrabold text-xs hover:bg-zinc-800 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
