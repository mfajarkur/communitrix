import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Award, Zap, ChevronRight, Trophy, Star } from 'lucide-react';

export default async function GlobalLeaderboardPage({
  params,
}: {
  params: Promise<{ communitySlug: string; sport: string }>;
}) {
  const { communitySlug, sport } = await params;
  const uppercaseSport = sport.toUpperCase();
  const profile = await requireProfile();
  const supabase = await createClient();

  // 1. Fetch community details
  const { data: community, error: cErr } = await supabase
    .from('communities')
    .select('id, name')
    .eq('slug', communitySlug)
    .single();

  if (cErr || !community) {
    notFound();
  }

  // 2. Fetch rankings ranked by Elo
  const { data: rankings, error: rErr } = await supabase
    .from('player_rankings')
    .select(`
      id,
      elo_rating,
      elo_peak,
      total_matches,
      total_wins,
      total_losses,
      total_draws,
      points_for,
      points_against,
      is_provisional,
      profile:profiles (
        id,
        full_name,
        avatar_url,
        is_guest
      )
    `)
    .eq('community_id', community.id)
    .eq('sport', uppercaseSport)
    .order('elo_rating', { ascending: false });

  if (rErr) {
    throw new Error('Failed to load leaderboard rankings.');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
          {uppercaseSport} Standings
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Global community rankings calculated using the official Elo formula.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        {rankings.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 space-y-2">
            <Trophy className="h-10 w-10 mx-auto opacity-30" />
            <p className="text-sm font-semibold">No rankings computed yet for this sport.</p>
            <p className="text-xs">Complete a match session to generate Elo ratings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/20">
                  <th className="p-4 w-16 text-center">Rank</th>
                  <th className="p-4">Player</th>
                  <th className="p-4 text-center">Rating</th>
                  <th className="p-4 text-center">Record (W-L-D)</th>
                  <th className="p-4 text-center">Win Rate</th>
                  <th className="p-4 text-right">Points +/-</th>
                  <th className="p-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                {rankings.map((r: any, idx) => {
                  const rank = idx + 1;
                  const winRate =
                    r.total_matches > 0
                      ? Math.round((r.total_wins / r.total_matches) * 100)
                      : 0;

                  const pDiff = r.points_for - r.points_against;

                  return (
                    <tr
                      key={r.id}
                      className="group hover:bg-zinc-50/40 dark:hover:bg-zinc-850/20 transition-all"
                    >
                      {/* Rank Column */}
                      <td className="p-4 text-center">
                        {rank === 1 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs font-black dark:bg-amber-950/40 dark:text-amber-400">
                            🏆
                          </span>
                        ) : rank === 2 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-800 text-xs font-black dark:bg-slate-900/60 dark:text-slate-400">
                            🥈
                          </span>
                        ) : rank === 3 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/10 text-amber-800 text-xs font-black dark:bg-amber-700/20 dark:text-amber-400">
                            🥉
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-zinc-400">{rank}</span>
                        )}
                      </td>

                      {/* Profile Column */}
                      <td className="p-4">
                        <Link
                          href={`/c/${communitySlug}/players/${r.profile.id}`}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 font-extrabold text-xs text-zinc-600 uppercase dark:bg-zinc-800 dark:text-zinc-300">
                            {r.profile.full_name.slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              {r.profile.full_name}
                              {r.profile.is_guest && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-zinc-100 text-zinc-500 text-[9px] font-bold uppercase dark:bg-zinc-800 dark:text-zinc-400">
                                  Guest
                                </span>
                              )}
                              {r.is_provisional && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase dark:bg-indigo-950/20 dark:text-indigo-400">
                                  <Star className="h-2 w-2 fill-current" />
                                  Prov
                                </span>
                              )}
                            </p>
                          </div>
                        </Link>
                      </td>

                      {/* Elo Rating */}
                      <td className="p-4 text-center">
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                          {Number(r.elo_rating).toFixed(0)}
                        </span>
                        <span className="block text-[10px] text-zinc-400">
                          Peak: {Number(r.elo_peak).toFixed(0)}
                        </span>
                      </td>

                      {/* Record W-L-D */}
                      <td className="p-4 text-center text-xs font-bold text-zinc-500">
                        {r.total_wins}W – {r.total_losses}L
                        {r.total_draws > 0 ? ` – ${r.total_draws}D` : ''}
                        <span className="block text-[10px] text-zinc-400 font-normal">
                          {r.total_matches} matches
                        </span>
                      </td>

                      {/* Win Rate */}
                      <td className="p-4 text-center">
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                          {winRate}%
                        </span>
                      </td>

                      {/* Points Differential */}
                      <td className={`p-4 text-right font-extrabold text-sm ${
                        pDiff > 0 ? 'text-emerald-500' : pDiff < 0 ? 'text-rose-500' : 'text-zinc-400'
                      }`}>
                        {pDiff > 0 ? '+' : ''}
                        {pDiff}
                      </td>

                      {/* Profile navigation chevron arrow */}
                      <td className="p-4 text-right">
                        <Link
                          href={`/c/${communitySlug}/players/${r.profile.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-all text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
