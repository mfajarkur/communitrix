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

  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (fullName.trim().length === 0) {
      setError('Please enter a full name.');
      setIsSubmitting(false);
      return;
    }

    const result = await addGuestPlayerAction({ communityId, fullName: fullName.trim(), gender });

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
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          required
          placeholder="Guest full name (e.g. John Doe)"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm"
        />
        <div className="inline-flex p-1 bg-zinc-100 rounded-lg border border-zinc-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setGender('MALE')}
            className={`px-2.5 py-1 rounded text-xs font-extrabold cursor-pointer transition-all ${
              gender === 'MALE' ? 'bg-orange-500 text-white shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            ♂️ Male
          </button>
          <button
            type="button"
            onClick={() => setGender('FEMALE')}
            className={`px-2.5 py-1 rounded text-xs font-extrabold cursor-pointer transition-all ${
              gender === 'FEMALE' ? 'bg-orange-500 text-white shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            ♀️ Female
          </button>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition-all cursor-pointer shrink-0 shadow-sm justify-center"
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
