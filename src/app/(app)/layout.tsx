import { requireProfile } from '@/server/guards';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileDrawer from './profile-drawer';
import { getMyProfileWithCommunities } from './profile-actions';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce auth and resolve user profile
  await requireProfile();
  const profileData = await getMyProfileWithCommunities();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-white w-full text-[#111827]">
      {/* Mobile Header */}
      <header className="flex items-center justify-between bg-orange-500 px-5 py-4 shrink-0 w-full shadow-sm text-white select-none">
        <Link href="/communities" className="flex items-center hover:opacity-95 transition-opacity">
          <span className="font-black uppercase tracking-widest text-white text-base font-sans">
            Communitrix
          </span>
        </Link>

        {profileData ? (
          <ProfileDrawer profileData={profileData} signOutAction={signOut} />
        ) : (
          <form action={signOut}>
            <button className="p-1.5 text-white/90 hover:text-red-200 transition-colors cursor-pointer text-xs font-sans">
              Sign Out
            </button>
          </form>
        )}
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 w-full max-w-7xl mx-auto flex flex-col min-h-0">
        {children}
      </main>
    </div>
  );
}
