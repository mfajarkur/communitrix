import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { notFound } from 'next/navigation';
import AddGuestForm from './add-guest-form';
import { Shield, User, CircleDot } from 'lucide-react';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ communitySlug: string }>;
}) {
  const { communitySlug } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // Fetch community details
  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', communitySlug)
    .maybeSingle();

  if (!community) {
    notFound();
  }

  // Fetch caller's membership
  const { data: callerMember } = await supabase
    .from('community_members')
    .select('*')
    .eq('community_id', community.id)
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!callerMember) {
    notFound();
  }

  // Fetch all members of this community
  const { data: members } = await supabase
    .from('community_members')
    .select(`
      role,
      is_active,
      joined_at,
      profile:profiles (
        id,
        full_name,
        is_guest,
        avatar_url
      )
    `)
    .eq('community_id', community.id)
    .order('joined_at', { ascending: true });

  const activeMembers = members || [];
  const isCallerAdmin = callerMember.role === 'ADMIN';

  return (
    <div className="grid gap-8 md:grid-cols-3">
      {/* Members List Table */}
      <div className="md:col-span-2 space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-bold text-zinc-950 dark:text-white">Players & Members</h3>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {activeMembers.map((m: any) => {
              const p = m.profile;
              if (!p) return null;
              const isMemberAdmin = m.role === 'ADMIN';

              return (
                <div key={p.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300 text-sm uppercase">
                      {p.full_name.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                        {p.full_name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {p.is_guest ? 'Guest Player' : 'Auth Account'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isMemberAdmin
                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300'
                        : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
                    }`}>
                      {isMemberAdmin ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {m.role}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <CircleDot className="h-2.5 w-2.5 text-emerald-500 fill-emerald-500" />
                      Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin Panel (Add Guest) */}
      <div className="space-y-6">
        {isCallerAdmin ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-zinc-950 dark:text-white">Add Guest Player</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Add players who do not have an account yet. You can invite them to claim their profile later.
              </p>
            </div>
            <AddGuestForm communityId={community.id} />
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Only community administrators can add guest players or manage member roles.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
