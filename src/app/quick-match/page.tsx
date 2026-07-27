import Link from 'next/link';
import WizardForm from '../(app)/c/[communitySlug]/sessions/new/wizard-form';
import { ArrowLeft, Zap, ShieldAlert } from 'lucide-react';

export default function QuickMatchPage() {
  return (
    <div className="relative min-h-screen bg-orange-950 text-white flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-x-hidden">
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <source
          src="https://lzzzjtijagandsrodaaj.supabase.co/storage/v1/object/public/assets/splash-bg.mp4"
          type="video/mp4"
        />
      </video>

      {/* Dark orange gradient overlay */}
      <div
        className="fixed inset-0 bg-gradient-to-b from-orange-950/90 via-zinc-950/95 to-black pointer-events-none"
        style={{ zIndex: 1 }}
      />

      {/* Page Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto space-y-6 my-4 px-2 sm:px-4">
        {/* COMMUNITRIX Branding Header */}
        <div className="flex flex-col items-center text-center w-full pt-2 pb-1">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-widest text-white font-sans drop-shadow-md">
            Communitrix
          </h1>
          <div className="w-full max-w-[280px] sm:max-w-[320px] overflow-hidden whitespace-nowrap mx-auto mt-1.5 select-none">
            <span className="animate-marquee text-xs text-white/90 font-light tracking-widest drop-shadow-sm uppercase">
              Elevate your community through intelligent matrix
            </span>
          </div>
        </div>

        {/* Header Bar */}
        <div className="flex items-center justify-between bg-black/40 border border-white/10 p-3.5 sm:p-4 rounded-2xl backdrop-blur-md shadow-lg">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
              <Zap className="h-3 w-3 text-amber-400 animate-pulse" />
              Quick Match (Sandbox)
            </span>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-light backdrop-blur-sm">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            <strong>Guest Mode:</strong> Test matchmaking & score calculation freely. Your session is auto-saved locally in browser.
          </span>
        </div>

        {/* Wizard Card Container */}
        <div className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-8 text-zinc-900 shadow-2xl">
          <WizardForm
            communityId="quick-match-demo"
            communitySlug="demo"
            players={[]}
            currentProfile={{
              id: 'guest-me',
              name: 'You (Host)',
              avatarUrl: null,
            }}
            isGuestDemoMode={true}
          />
        </div>
      </div>

      {/* Footer Contact Us Text Line */}
      <div className="relative z-10 text-center text-xs font-normal text-white drop-shadow-md select-none font-sans px-4 pt-6 pb-4">
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
