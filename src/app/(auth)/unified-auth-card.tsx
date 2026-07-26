'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { AlertCircle, Loader2, Lock, User, Eye, EyeOff, Zap, LogIn, ArrowLeft } from 'lucide-react';
import { loginWithUsernameOrEmail } from './auth-actions';

const GoogleIcon = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.05,3.1l3.19,2.47c1.87,-1.72 2.94,-4.26 2.94,-7.22c0,-0.74 -0.07,-1.4 -0.21,-2.05Z" fill="#4285F4" />
    <path d="M12,20.62c2.43,0 4.47,-0.81 5.96,-2.2l-3.19,-2.47c-0.89,0.6 -2.02,0.96 -3.37,0.96c-2.59,0 -4.79,-1.75 -5.57,-4.1l-3.3,2.56c1.63,3.24 4.97,5.42 8.87,5.42Z" fill="#34A853" />
    <path d="M6.43,12.81c-0.2,-0.6 -0.31,-1.24 -0.31,-1.9c0,-0.66 0.11,-1.3 0.31,-1.9L3.13,6.45c-0.71,1.42 -1.13,3.02 -1.13,4.72c0,1.7 0.42,3.3 1.13,4.72l3.3,-2.56Z" fill="#FBBC05" />
    <path d="M12,3.38c1.32,0 2.51,0.45 3.44,1.35l2.58,-2.58C16.46,0.85 14.41,0 12,0c-3.9,0 -7.24,2.18 -8.87,5.42l3.3,2.56c0.78,-2.35 2.98,-4.1 5.57,-4.1Z" fill="#EA4335" />
  </svg>
);

function UnifiedAuthCardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [view, setView] = useState<'main' | 'login'>('main');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(errorParam);
      setView('login');
    }
  }, [searchParams]);

  const handleGoogleAuth = async () => {
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setIsSubmitting(false);
      setError(authError.message);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please enter your username/email and password');
      return;
    }

    setIsPasswordSubmitting(true);
    setError(null);

    const result = await loginWithUsernameOrEmail(identifier, password);
    setIsPasswordSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push('/communities');
      router.refresh();
    }
  };

  return (
    <div className="w-full">
      {/* ---------------------------------------------------- */}
      {/* VIEW 1: MAIN MENU (GET STARTED + 2 BUTTONS ONLY) */}
      {/* ---------------------------------------------------- */}
      {view === 'main' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-xl font-black text-white font-sans uppercase tracking-widest text-center drop-shadow-sm">
              Get Started
            </h3>
            <p className="text-xs text-white/80 mt-1.5 text-center leading-relaxed font-sans font-light">
              Join or test Communitrix matchmaking & scoring system.
            </p>
          </div>

          <div className="space-y-3.5">
            {/* 1. LOGIN BUTTON (Replaces Card Content with Login View) */}
            <button
              onClick={() => {
                setError(null);
                setView('login');
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-50 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-zinc-900 transition-all shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99] font-sans"
            >
              <LogIn className="h-4 w-4 text-orange-600 shrink-0" />
              <span>LOGIN</span>
            </button>

            {/* 2. QUICK MATCHUP BUTTON */}
            <Link
              href="/quick-match"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 border border-orange-400/40 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99] font-sans group"
            >
              <Zap className="h-4 w-4 text-amber-300 animate-pulse shrink-0 group-hover:scale-110 transition-transform" />
              <span>QUICK MATCHUP</span>
            </Link>
          </div>
        </div>
      ) : (
        /* ---------------------------------------------------- */
        /* VIEW 2: LOGIN FORM (REPLACES GET STARTED CARD) */
        /* ---------------------------------------------------- */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Header with Back Button */}
          <div className="flex items-center justify-between border-b border-white/15 pb-3">
            <button
              onClick={() => {
                setError(null);
                setView('main');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white transition-colors cursor-pointer bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <h4 className="text-xs font-black uppercase tracking-wider font-sans text-orange-400">
              Sign In to Communitrix
            </h4>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-950/60 border border-red-500/40 p-3 text-xs text-red-200 font-sans">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Login Option */}
          <button
            onClick={handleGoogleAuth}
            disabled={isSubmitting || isPasswordSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white hover:bg-zinc-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-900 disabled:opacity-50 transition-all shadow-md cursor-pointer font-sans"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            ) : (
              <GoogleIcon />
            )}
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="w-full border-t border-white/20" />
            <span className="absolute bg-[#1a0e05]/80 px-3 text-[10px] font-bold uppercase tracking-widest text-white/50 font-sans backdrop-blur-xs">
              or password sign in
            </span>
          </div>

          {/* Username / Email + Password Login Form */}
          <form onSubmit={handlePasswordLogin} className="space-y-3 font-sans">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username or Email"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs font-light text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white/15 transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs font-light text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white/15 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isPasswordSubmitting || isSubmitting}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              {isPasswordSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing In...
                </>
              ) : (
                'Sign In with Password'
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function UnifiedAuthCard() {
  return (
    <Suspense fallback={
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    }>
      <UnifiedAuthCardContent />
    </Suspense>
  );
}
