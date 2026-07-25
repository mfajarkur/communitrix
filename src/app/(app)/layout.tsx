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
    <div className="flex-1 flex flex-col min-h-screen bg-white w-full text-[#111827]">
      {/* Mobile Header (rendered consistently on all devices) */}
      <header className="flex items-center justify-between bg-orange-500 px-5 py-4 shrink-0 w-full shadow-sm text-white select-none">
        <Link href="/communities" className="flex items-center hover:opacity-95 transition-opacity">
          <span className="font-black uppercase tracking-widest text-white text-base font-sans">
            Communitrix
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/communities/new"
            className="p-1.5 text-white/90 hover:text-white transition-colors"
            title="Create Community"
          >
            <Plus className="h-5 w-5" />
          </Link>
          <form action={signOut} className="flex">
            <button className="p-1.5 text-white/90 hover:text-red-200 transition-colors cursor-pointer">
              <LogOut className="h-5 w-5" />
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
