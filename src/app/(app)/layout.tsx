import { requireProfile } from '@/server/guards';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileDrawer from './profile-drawer';
import { getMyProfileWithCommunities } from './profile-actions';
import Footer from '@/components/footer';

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
      <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 w-full max-w-7xl mx-auto flex flex-col min-h-0">
        {children}
      </main>
      <Footer />
    </div>
  );
}
