import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UnifiedAuthCard from './(auth)/unified-auth-card';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to app if already authenticated
  if (user) {
    redirect('/communities');
  }

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center bg-zinc-950 p-6 select-none overflow-hidden w-full">
      {/* Rich orange gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-600 via-orange-600/90 to-orange-950 pointer-events-none" />
      {/* Background Image backdrop on top of gradient */}
      <img
        src="/community_banner_placeholder.png"
        alt="Communitrix Sports"
        className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-overlay pointer-events-none select-none"
      />

      <div className="relative z-10 w-full max-w-sm space-y-7">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-4xl font-black uppercase tracking-widest text-white font-sans drop-shadow-md">
            Communitrix
          </h2>
          <p className="text-xs text-white/90 mt-2 font-light tracking-wide max-w-[280px] mx-auto leading-relaxed drop-shadow-sm">
            Unlocking intelligent matrix to elevate your community
          </p>
        </div>
        <div className="rounded-2xl bg-black/35 border border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.35)] backdrop-blur-md p-7 text-white">
          <UnifiedAuthCard />
        </div>
      </div>
    </div>
  );
}
