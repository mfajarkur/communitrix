import { requireProfile } from '@/server/guards';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Compass, ChevronRight, Shield, User } from 'lucide-react';
import { getMyProfileWithCommunities, getMyStatsHighlights } from '../profile-actions';
import ProfileCard from './profile-card';

export default async function CommunitiesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [profileData, stats] = await Promise.all([
    getMyProfileWithCommunities(),
    getMyStatsHighlights(),
  ]);

  // Fetch all communities where user is active
  const { data: memberships } = await supabase
    .from('community_members')
    .select(`
      role,
      community:communities (
        id,
        name,
        slug,
        join_code,
        join_code_enabled,
        default_sport
      )
    `)
    .eq('profile_id', profile.id)
    .eq('is_active', true);

  const activeMemberships = memberships || [];

  return (
    <div className="space-y-8 bg-white">
      {/* Profile header: photo, name, gender, stats highlights, edit, log out */}
      {profileData && <ProfileCard profileData={profileData} stats={stats} />}

      {/* Top Banner */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-[#111827]">My Communities</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage your organizations, view leaderboards, and launch sessions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/communities/join"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm"
          >
            <Compass className="h-4 w-4 text-zinc-400" />
            Join Code
          </Link>
          <Link
            href="/communities/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Community
          </Link>
        </div>
      </div>

      {/* Grid of communities */}
      {activeMemberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 mb-4">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">No communities found</h3>
          <p className="text-sm text-zinc-500 max-w-sm mt-1 mb-6">
            You are not part of any communities yet. Create a new one or join an existing community using a code.
          </p>
          <div className="flex gap-4">
            <Link
              href="/communities/join"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm"
            >
              <Compass className="h-4 w-4" />
              Join Code
            </Link>
            <Link
              href="/communities/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-white hover:bg-orange-600 transition-all"
            >
              <Plus className="h-4 w-4" />
              Create One
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1">
          {activeMemberships.map((m: any) => {
            const comm = m.community;
            if (!comm) return null;
            const isAdmin = m.role === 'ADMIN';
            const bannerImage = comm.logo_url || '/community_banner_placeholder.png';

            return (
              <Link
                href={`/c/${comm.slug}`}
                key={comm.id}
                className="group relative overflow-hidden rounded-2xl h-40 bg-zinc-950 flex flex-col justify-end p-5 text-white shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all border border-zinc-100"
              >
                {/* Banner image */}
                <img
                  src={bannerImage}
                  alt={comm.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-50 select-none pointer-events-none group-hover:scale-105 transition-transform duration-300"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-orange-600/95 via-orange-600/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-orange-950/30 via-transparent to-transparent" />

                {/* Content on top */}
                <div className="relative z-10 space-y-3 w-full">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-white/15 border border-white/10 text-white shadow-sm">
                      {comm.default_sport}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-wider uppercase border border-white/20 shadow-sm ${
                      m.role === 'ADMIN'
                        ? 'bg-orange-500 text-white'
                        : m.role === 'HOST'
                        ? 'bg-white text-orange-600'
                        : 'bg-white/80 text-zinc-800'
                    }`}>
                      {m.role === 'ADMIN' ? <Shield className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                      {m.role}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black leading-tight text-white tracking-tight drop-shadow-sm font-sans">
                      {comm.name}
                    </h3>
                    <p className="text-[10px] text-white/75">/c/{comm.slug}</p>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    {isAdmin && comm.join_code_enabled ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white/90 bg-white/15 border border-white/10 px-2 py-0.5 rounded shadow-sm font-mono tracking-wider uppercase">
                        Code: {comm.join_code}
                      </span>
                    ) : (
                      <span />
                    )}

                    <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-white group-hover:translate-x-0.5 transition-transform">
                      Enter
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Simple internal icon helper since we imports Trophy from lucide-react elsewhere
function Users(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
