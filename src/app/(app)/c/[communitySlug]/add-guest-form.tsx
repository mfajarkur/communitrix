'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addGuestPlayerAction } from '@/server/actions/member.actions';
import { UserPlus, AlertCircle, Loader2 } from 'lucide-react';

export default function AddGuestForm({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (fullName.trim().length === 0) {
      setError('Please enter a full name.');
      setIsSubmitting(false);
      return;
    }

    const result = await addGuestPlayerAction({ communityId, fullName: fullName.trim() });

    if (result.ok) {
      setFullName('');
      setIsSubmitting(false);
      router.refresh();
    } else {
      setIsSubmitting(false);
      setError(result.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          required
          placeholder="Guest full name (e.g. John Doe)"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:text-white dark:placeholder-zinc-500"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer shrink-0 shadow-sm"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Add Guest
        </button>
      </div>
    </form>
  );
}
