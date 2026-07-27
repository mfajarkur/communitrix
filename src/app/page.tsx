import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UnifiedAuthCard from './(auth)/unified-auth-card';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const params = await searchParams;

  // Forward OAuth code to the proper callback handler if it lands on root
  if (params.code) {
    const next = params.next ?? '/communities';
    redirect(`/auth/callback?code=${params.code}&next=${next}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to app if already authenticated
  if (user) {
    redirect('/communities');
  }

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center p-6 select-none overflow-hidden bg-orange-900 w-full">
      {/* Video background - bottom layer */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      >
        <source src="https://lzzzjtijagandsrodaaj.supabase.co/storage/v1/object/public/assets/splash-bg.mp4" type="video/mp4" />
      </video>

      {/* Orange gradient overlay on top of video */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-orange-600/80 via-orange-500/50 to-orange-950/90 pointer-events-none"
        style={{ zIndex: 1 }}
      />

      {/* Content on top of everything */}
      <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl space-y-7" style={{ zIndex: 2 }}>
        <div className="flex flex-col items-center text-center w-full">
          <h2 className="text-4xl font-black uppercase tracking-widest text-white font-sans drop-shadow-md">
            Communitrix
          </h2>
          <div className="w-full max-w-[280px] overflow-hidden whitespace-nowrap mx-auto mt-2 select-none">
            <span className="animate-marquee text-xs text-white/90 font-light tracking-widest drop-shadow-sm uppercase">
              Elevate your community through intelligent matrix
            </span>
          </div>
        </div>
        <div className="rounded-2xl bg-black/35 border border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.35)] backdrop-blur-md p-7 text-white">
          <UnifiedAuthCard />
        </div>

      </div>

      {/* Text directly at the very bottom edge of the page, floating over background */}
      <div className="absolute bottom-4 left-0 right-0 z-10 text-center text-xs font-normal text-white drop-shadow-md select-none font-sans px-4">
        <a
          href="https://instagram.com/communitrix.id"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-orange-300 hover:underline transition-colors font-bold text-white"
        >
          Contact Us
        </a>
        <span className="mx-2 opacity-70">•</span>
        <span className="opacity-90">Version 1.0 © 2026 Communitrix</span>
      </div>
    </div>
  );
}
