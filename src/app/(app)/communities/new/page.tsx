'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCommunityAction } from '@/server/actions/community.actions';
import Link from 'next/link';
import { ArrowLeft, PlusCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function NewCommunityPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Helper to convert community name into a URL-friendly slug
  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start
      .replace(/-+$/, ''); // Trim - from end
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    // Auto-populate slug if user hasn't customized it manually
    setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    const result = await createCommunityAction({ name, slug });

    if (result.ok) {
      router.push(`/communities`);
      router.refresh();
    } else {
      setIsSubmitting(false);
      setError(result.message);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
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
        <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">Create a Community</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Form a new group, invite players, and start managing padel sessions.
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

          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-semibold text-zinc-700">
              Community Name
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="e.g. Westside Padel Club"
              value={name}
              onChange={handleNameChange}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm"
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="slug" className="text-sm font-semibold text-zinc-700">
              Community URL Slug
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-sm text-zinc-400 select-none">
                c/
              </span>
              <input
                id="slug"
                type="text"
                required
                placeholder="westside-padel-club"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 bg-white pl-8 pr-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm"
              />
            </div>
            <p className="text-xs text-zinc-400">
              Only lowercase letters, numbers, and hyphens (3-40 characters).
            </p>
            {fieldErrors.slug && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.slug[0]}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-orange-600 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                Create Community
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
