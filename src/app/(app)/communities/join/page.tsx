'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinCommunityAction } from '@/server/actions/community.actions';
import Link from 'next/link';
import { ArrowLeft, Compass, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

export default function JoinCommunityPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const trimmedCode = joinCode.trim().toUpperCase();
    if (trimmedCode.length === 0) {
      setError('Please enter a join code.');
      setIsSubmitting(false);
      return;
    }

    const result = await joinCommunityAction({ joinCode: trimmedCode });

    if (result.ok) {
      setSuccess(`Successfully joined ${result.data.community.name}! Redirecting...`);
      // Redirect to the newly joined community's dashboard
      setTimeout(() => {
        router.push(`/c/${result.data.community.slug}`);
        router.refresh();
      }, 1500);
    } else {
      setIsSubmitting(false);
      setError(result.message);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 bg-white">
      <div>
        <Link
          href="/communities"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-orange-600 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Communities
        </Link>
        <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">Join a Community</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Enter an 8-character invitation join code to join an existing group.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="joinCode" className="text-sm font-semibold text-zinc-700">
              Invitation Join Code
            </label>
            <input
              id="joinCode"
              type="text"
              required
              maxLength={8}
              placeholder="e.g. 5A9F2D1E"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              disabled={isSubmitting || success !== null}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono tracking-widest text-center text-lg shadow-sm"
            />
            <p className="text-xs text-zinc-400 text-center">
              Codes are 8 characters, case-insensitive, and alphanumeric.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || success !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-orange-600 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Compass className="h-4 w-4" />
                Join Community
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
