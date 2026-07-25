import { requireProfile } from '@/server/guards';
import Link from 'next/link';
import { Trophy, Users, LogOut, Plus, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce auth and resolve user profile
  const profile = await requireProfile();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-black w-full text-white">
      {/* Mobile Header (rendered consistently on all devices) */}
      <header className="flex items-center justify-between border-b border-white/10 bg-black px-5 py-3.5 shrink-0 w-full">
        <Link href="/communities" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <span className="font-semibold text-white text-sm">Communitrix</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/communities/new"
            className="p-2 text-white/60 hover:text-yellow-400 transition-colors"
            title="Create Community"
          >
            <Plus className="h-4.5 w-4.5" />
          </Link>
          <form action={signOut} className="flex">
            <button className="p-2 text-white/60 hover:text-rose-500 transition-colors cursor-pointer">
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-4 w-full flex flex-col min-h-0">
        {children}
      </main>
    </div>
  );
}
