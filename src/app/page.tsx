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
    <div className="flex-1 flex flex-col items-center justify-center bg-orange-500 p-6 select-none w-full">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-3xl font-black uppercase tracking-widest text-white font-sans drop-shadow-sm">
            Communitrix
          </h2>
          <p className="text-sm text-white/90 mt-2 font-light">
            Unlocking intelligent matrix to elevate your community
          </p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-orange-600/10 text-zinc-900">
          <UnifiedAuthCard />
        </div>
      </div>
    </div>
  );
}
