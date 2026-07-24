import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Trophy, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to app if already authenticated
  if (user) {
    redirect('/communities');
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-zinc-200/80 bg-white/50 backdrop-blur-md sticky top-0 z-50 dark:border-zinc-800/80 dark:bg-zinc-950/50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none">
            <Trophy className="h-4.5 w-4.5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-950 dark:text-white">Communitrix</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-sm"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
          <Zap className="h-3.5 w-3.5 fill-indigo-600/10" />
          Introducing Phase 2 Community CRUD
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-tight">
          Ratings & Matchmaking For Your Club, Simplified.
        </h1>

        <p className="text-base sm:text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
          Create custom padel and tennis communities, invite players via secure join codes, run balanced Americano or Mexicano rounds, and track Elo leaderboard statistics.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-xs sm:max-w-none">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-150 dark:shadow-none"
          >
            Create Account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 text-base font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
          >
            Access Dashboard
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="grid gap-6 sm:grid-cols-2 pt-16 w-full text-left">
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg text-zinc-950 dark:text-white">Tenant Isolation</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Every community operates inside strict database-level Row Level Security policies, keeping your matches and rankings fully private.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 mb-4">
              <Trophy className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg text-zinc-950 dark:text-white">Dynamic Standing Views</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Auto-calculating leaderboards driven by PostgreSQL security-invoking views, ensuring accurate ratings without tenant leaks.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
        &copy; {new Date().getFullYear()} Communitrix. Built using Next.js 16 and Supabase.
      </footer>
    </div>
  );
}
