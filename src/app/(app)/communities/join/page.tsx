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
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <Link
          href="/communities"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Communities
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Join a Community</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Enter an 8-character invitation join code to join an existing group.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="joinCode" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
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
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:text-white dark:placeholder-zinc-500 font-mono tracking-widest text-center text-lg"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
              Codes are 8 characters, case-insensitive, and alphanumeric.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || success !== null}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
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
