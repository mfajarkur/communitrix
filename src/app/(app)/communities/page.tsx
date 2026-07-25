import { requireProfile } from '@/server/guards';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Compass, ChevronRight, Share2, Shield, User } from 'lucide-react';

export default async function CommunitiesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

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
      {/* Top Banner */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#111827]">My Communities</h2>
          <p className="text-sm text-zinc-500 mt-1">
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

            return (
              <div
                key={comm.id}
                className="group relative flex flex-col justify-between p-6 rounded-2xl border border-zinc-100 bg-zinc-50 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-zinc-150 text-zinc-500">
                      {comm.default_sport}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      isAdmin 
                        ? 'bg-orange-500/10 text-orange-600' 
                        : 'bg-zinc-150 text-zinc-500'
                    }`}>
                      {isAdmin ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {m.role}
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-[#111827] leading-snug">
                    {comm.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">/c/{comm.slug}</p>
                </div>

                <div className="mt-8 pt-4 border-t border-zinc-200/60 flex items-center justify-between">
                  {isAdmin && comm.join_code_enabled ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Share2 className="h-3.5 w-3.5" />
                      <span>Code: <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200/50">{comm.join_code}</code></span>
                    </div>
                  ) : (
                    <span />
                  )}

                  <Link
                    href={`/c/${comm.slug}`}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-orange-500 hover:text-orange-600"
                  >
                    Enter
                    <ChevronRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
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
