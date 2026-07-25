'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const GoogleIcon = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.05,3.1l3.19,2.47c1.87,-1.72 2.94,-4.26 2.94,-7.22c0,-0.74 -0.07,-1.4 -0.21,-2.05Z" fill="#4285F4" />
    <path d="M12,20.62c2.43,0 4.47,-0.81 5.96,-2.2l-3.19,-2.47c-0.89,0.6 -2.02,0.96 -3.37,0.96c-2.59,0 -4.79,-1.75 -5.57,-4.1l-3.3,2.56c1.63,3.24 4.97,5.42 8.87,5.42Z" fill="#34A853" />
    <path d="M6.43,12.81c-0.2,-0.6 -0.31,-1.24 -0.31,-1.9c0,-0.66 0.11,-1.3 0.31,-1.9L3.13,6.45c-0.71,1.42 -1.13,3.02 -1.13,4.72c0,1.7 0.42,3.3 1.13,4.72l3.3,-2.56Z" fill="#FBBC05" />
    <path d="M12,3.38c1.32,0 2.51,0.45 3.44,1.35l2.58,-2.58C16.46,0.85 14.41,0 12,0c-3.9,0 -7.24,2.18 -8.87,5.42l3.3,2.56c0.78,-2.35 2.98,-4.1 5.57,-4.1Z" fill="#EA4335" />
  </svg>
);

export default function SignupPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignup = async () => {
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

  return (
    <div className="space-y-6 bg-white">
      <div>
        <h3 className="text-xl font-extrabold text-[#111827]">Create an Account</h3>
        <p className="text-sm text-zinc-500 mt-1">
          Register to join communities and track your Elo ratings.
        </p>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleGoogleSignup}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
          ) : (
            <GoogleIcon />
          )}
          <span>Sign Up with Google</span>
        </button>
      </div>

      <div className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-bold text-orange-500 hover:text-orange-600"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
