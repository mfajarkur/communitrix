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
    <div className="flex flex-col min-h-screen bg-orange-500 text-white font-sans select-none">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <span className="font-black text-lg tracking-widest text-white uppercase font-sans">Communitrix</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-bold text-white/90 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-all shadow-sm"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/10 px-3 py-1 text-xs font-bold text-white shadow-sm">
          <Zap className="h-3.5 w-3.5 fill-white/10" />
          Introducing Phase 2 Community CRUD
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight font-sans drop-shadow-sm">
          Ratings & Matchmaking For Your Club, Simplified.
        </h1>

        <p className="text-base sm:text-lg text-white/90 font-medium max-w-2xl leading-relaxed">
          Create custom padel and tennis communities, invite players via secure join codes, run balanced Americano or Mexicano rounds, and track Elo leaderboard statistics.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-xs sm:max-w-none">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-bold text-orange-600 hover:bg-orange-50 transition-all shadow-lg shadow-orange-600/10"
          >
            Create Account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 text-base font-bold text-white hover:bg-white/20 transition-all"
          >
            Access Dashboard
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="grid gap-6 sm:grid-cols-2 pt-16 w-full text-left">
          <div className="p-6 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm">
            <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center text-white mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg text-white">Tenant Isolation</h3>
            <p className="text-sm text-white/80 mt-2">
              Every community operates inside strict database-level Row Level Security policies, keeping your matches and rankings fully private.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm">
            <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center text-white mb-4">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg text-white">Dynamic Standing Views</h3>
            <p className="text-sm text-white/80 mt-2">
              Auto-calculating leaderboards driven by PostgreSQL security-invoking views, ensuring accurate ratings without tenant leaks.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10 text-center text-xs text-white/70">
        &copy; {new Date().getFullYear()} Communitrix. Built using Next.js 16 and Supabase.
      </footer>
    </div>
  );
}
