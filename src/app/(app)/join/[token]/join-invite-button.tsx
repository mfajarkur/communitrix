'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus, Clock } from 'lucide-react';
import { requestJoinCommunityByIdAction } from '@/server/actions/community.actions';

export default function JoinInviteButton({
  communityId,
  communitySlug,
  inviteToken,
}: {
  communityId: string;
  communitySlug: string;
  inviteToken: string;
}) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setIsJoining(true);
    setError(null);
    try {
      const res = await requestJoinCommunityByIdAction(communityId, inviteToken);
      if (res.ok) {
        if (res.data.status === 'JOINED') {
          router.push(`/c/${communitySlug}`);
        } else {
          setStatus('pending');
        }
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to join community');
    } finally {
      setIsJoining(false);
    }
  };

  if (status === 'pending') {
    return (
      <div className="text-center space-y-2 py-4 bg-zinc-50 rounded-2xl border border-zinc-100">
        <Clock className="h-7 w-7 mx-auto text-orange-500" />
        <p className="text-sm font-bold text-zinc-800">Request sent</p>
        <p className="text-xs text-zinc-500">Waiting for an admin to approve your request to join.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600 font-semibold text-center">{error}</p>}
      <button
        type="button"
        onClick={handleJoin}
        disabled={isJoining}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition-all shadow-sm cursor-pointer"
      >
        {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Request to Join
      </button>
    </div>
  );
}
