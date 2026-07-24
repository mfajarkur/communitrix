import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Activity, Award, UserCheck, Calendar } from 'lucide-react';

export default async function CommunityDashboardPage({
  params,
}: {
  params: Promise<{ communitySlug: string }>;
}) {
  const { communitySlug } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // Fetch the community
  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', communitySlug)
    .maybeSingle();

  if (!community) {
    notFound();
  }

  // Fetch the number of members in this community
  const { count: memberCount } = await supabase
    .from('community_members')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', community.id)
    .eq('is_active', true);

  // Fetch member role
  const { data: membership } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', community.id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  const isAdmin = membership?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Title & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">{community.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Community Hub and matchmaking dashboard.</p>
        </div>
        {isAdmin && (
          <Link
            href={`/c/${communitySlug}/sessions/new`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-sm cursor-pointer"
          >
            <Activity className="h-4 w-4" />
            Start Session
          </Link>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Players</p>
            <h4 className="text-2xl font-bold text-zinc-950 dark:text-white mt-0.5">{memberCount || 0}</h4>
          </div>
        </div>

        <div className="flex items-center gap-4 p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Active Sessions</p>
            <h4 className="text-2xl font-bold text-zinc-950 dark:text-white mt-0.5">0</h4>
          </div>
        </div>

        <div className="flex items-center gap-4 p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Matches Played</p>
            <h4 className="text-2xl font-bold text-zinc-950 dark:text-white mt-0.5">0</h4>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <h3 className="text-lg font-bold text-zinc-950 dark:text-white mb-2 flex items-center gap-2">
          <Award className="h-5 w-5 text-indigo-600" />
          Welcome to {community.name}!
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
          This community dashboard is fully integrated with your Supabase database. You are officially authenticated and have successfully completed **Phase 2 (Community Setup)**.
        </p>
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 dark:bg-indigo-950/10 dark:border-indigo-900/30 text-xs text-indigo-800 dark:text-indigo-300">
          <p className="font-semibold mb-1">What's Next?</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>In **Phase 3**, we will build out pure TS matchmaking algorithms for Americano and Mexicano formats.</li>
            <li>In **Phase 4**, we will add session wizard and round generation logic to set up courtside scoring.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
