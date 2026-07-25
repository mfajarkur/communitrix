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
    <div className="relative flex flex-col min-h-screen bg-orange-600 text-white font-sans overflow-hidden select-none items-center justify-center p-6 text-center">
      {/* Background Image backdrop */}
      <img
        src="/community_banner_placeholder.png"
        alt="Communitrix Sports"
        className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-overlay pointer-events-none select-none"
      />
      {/* Rich orange gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-500/90 via-orange-600/95 to-orange-700/98 pointer-events-none" />

      {/* Main Centered Content */}
      <div className="relative z-10 space-y-8 max-w-md w-full">
        <div className="space-y-3">
          <h1 className="text-5xl sm:text-6xl font-black tracking-widest text-white uppercase drop-shadow-md font-sans">
            Communitrix
          </h1>
          <p className="text-sm sm:text-base text-white/95 font-light tracking-wide max-w-sm mx-auto leading-relaxed drop-shadow-sm font-sans">
            Unlocking intelligent matrix to elevate your community
          </p>
        </div>

        <div className="flex gap-4 justify-center pt-4 w-full">
          <Link
            href="/login"
            className="flex-1 inline-flex h-12 items-center justify-center rounded-xl bg-white text-orange-600 font-bold text-sm hover:bg-orange-50 transition-all shadow-md active:scale-[0.98]"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="flex-1 inline-flex h-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all shadow-sm active:scale-[0.98]"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
