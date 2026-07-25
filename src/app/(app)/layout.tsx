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
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar (Desktop) */}
      <aside className="hidden w-64 border-r border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 md:block">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-zinc-950 dark:text-white leading-tight">Communitrix</h1>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Matchmaker & Ratings</span>
          </div>
        </div>

        <nav className="space-y-1">
          <Link
            href="/communities"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-all"
          >
            <Users className="h-4 w-4" />
            My Communities
          </Link>
          <Link
            href="/communities/new"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-all"
          >
            <Plus className="h-4 w-4" />
            Create Community
          </Link>
        </nav>

        {/* User Card & Sign Out */}
        <div className="absolute bottom-6 left-6 right-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold uppercase">
              {profile.full_name.substring(0, 2)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-zinc-950 dark:text-white truncate">{profile.full_name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {profile.is_guest ? 'Guest Player' : 'Player Account'}
              </p>
            </div>
          </div>
          <form action={signOut}>
            <button className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all text-left">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="flex md:hidden items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900 shrink-0">
          <Link href="/communities" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Trophy className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-zinc-950 dark:text-white">Communitrix</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/communities/new"
              className="p-2 text-zinc-500 hover:text-indigo-600 transition-colors"
              title="Create Community"
            >
              <Plus className="h-5 w-5" />
            </Link>
            <form action={signOut} className="flex">
              <button className="p-2 text-zinc-500 hover:text-red-650 transition-colors cursor-pointer">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-10 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
