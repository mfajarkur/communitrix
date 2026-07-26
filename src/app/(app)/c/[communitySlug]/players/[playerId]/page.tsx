import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  Activity,
  Trophy,
  Award,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Shield,
  User,
} from 'lucide-react';
import { getDisplayName } from '@/lib/utils/profile';
import ProfileEditor from './profile-editor';

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ communitySlug: string; playerId: string }>;
}) {
  const { communitySlug, playerId } = await params;
  const loggedInProfile = await requireProfile();
  const isOwnProfile = loggedInProfile.id === playerId;
  const supabase = await createClient();

  // 1. Fetch community details
  const { data: community, error: cErr } = await supabase
    .from('communities')
    .select('id, name, default_sport')
    .eq('slug', communitySlug)
    .single();

  if (cErr || !community) {
    notFound();
  }

  // 2. Fetch Player profile details
  const { data: player, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, username, avatar_url, is_guest, created_at')
    .eq('id', playerId)
    .single();

  if (pErr || !player) {
    notFound();
  }

  // Fetch player's membership role record
  const { data: memberRecord } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', community.id)
    .eq('profile_id', playerId)
    .maybeSingle();

  // 3. Fetch Player rankings for all sports in this community
  const { data: rankings } = await supabase
    .from('player_rankings')
    .select('sport, elo_rating, elo_peak, total_matches, total_wins, total_losses, total_draws')
    .eq('community_id', community.id)
    .eq('profile_id', playerId);

  // 4. Fetch Match History log
  const { data: rawHistory } = await supabase
    .from('match_players')
    .select(`
      id,
      team,
      slot,
      elo_before,
      elo_delta,
      elo_after,
      match:matches (
        id,
        round_number,
        team_a_score,
        team_b_score,
        winner_side,
        status,
        completed_at,
        session:sessions (
          id,
          session_name,
          sport
        )
      )
    `)
    .eq('profile_id', playerId)
    .eq('community_id', community.id);

  const matchHistory = rawHistory || [];

  // Filter out matches that aren't completed yet
  const completedMatches = (matchHistory as any[])
    .filter((mh: any) => mh.match?.status === 'COMPLETED')
    .sort((a: any, b: any) => {
      const dateA = new Date(a.match.completed_at).getTime();
      const dateB = new Date(b.match.completed_at).getTime();
      return dateB - dateA; // Descending order
    });

  // Fetch teammate & opponent details for these matches
  const matchIds = completedMatches.map((mh: any) => (mh.match as any).id);
  let teammatesMap = new Map<string, string[]>();
  let opponentsMap = new Map<string, string[]>();

  if (matchIds.length > 0) {
    const { data: allMatchPlayers } = await supabase
      .from('match_players')
      .select(`
        match_id,
        team,
        profile:profiles (
          id,
          full_name,
          display_name
        )
      `)
      .in('match_id', matchIds);

    allMatchPlayers?.forEach((mp: any) => {
      const mh = completedMatches.find((x: any) => x.match.id === mp.match_id);
      if (!mh) return;

      const pName = getDisplayName(mp.profile);
      const isSelf = mp.profile?.id === playerId;

      if (mp.team === mh.team) {
        if (!isSelf) {
          const list = teammatesMap.get(mp.match_id) || [];
          teammatesMap.set(mp.match_id, [...list, pName]);
        }
      } else {
        const list = opponentsMap.get(mp.match_id) || [];
        opponentsMap.set(mp.match_id, [...list, pName]);
      }
    });
  }

  const displayName = getDisplayName(player);

  return (
    <div className="space-y-8 bg-white">
      {/* Back button */}
      <div>
        <Link
          href={`/c/${communitySlug}?tab=leaderboard`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-550 hover:text-orange-500 transition-colors bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5 shadow-sm"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Standings
        </Link>
      </div>

      {/* Profile Header Cards */}
      <div className="flex flex-row gap-4 items-center justify-between border-b border-zinc-100 pb-6">
        <div className="flex items-center gap-4 min-w-0">
          {player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={displayName}
              className="h-16 w-16 rounded-2xl object-cover border border-zinc-100 shrink-0 shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-650 font-extrabold text-2xl uppercase shrink-0">
              {displayName.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 className="text-xl font-extrabold text-[#111827] leading-tight truncate">
                  {displayName}
                </h2>
                {memberRecord && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                    memberRecord.role === 'ADMIN'
                      ? 'bg-orange-500/10 text-orange-600'
                      : memberRecord.role === 'HOST'
                      ? 'bg-orange-500/[0.04] text-orange-600/80'
                      : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {memberRecord.role === 'ADMIN' ? (
                      <Shield className="h-2.5 w-2.5" />
                    ) : (
                      <User className="h-2.5 w-2.5" />
                    )}
                    {memberRecord.role}
                  </span>
                )}
                {player.is_guest && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 text-[9px] font-bold uppercase shrink-0">
                    Guest
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                Member since: {new Date(player.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>
          </div>
        </div>

        {isOwnProfile && (
          <div className="shrink-0">
            <ProfileEditor fullName={player.full_name} avatarUrl={player.avatar_url} />
          </div>
        )}
      </div>

      {/* Sport Ratings Overview Grid */}
      <div className="grid grid-cols-1 gap-6">
        {rankings && rankings.length > 0 ? (
          rankings.map((r: any) => {
            const winRate =
              r.total_matches > 0 ? Math.round((r.total_wins / r.total_matches) * 100) : 0;
            return (
              <div
                key={r.sport}
                className="p-5 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4"
              >
                <div className="flex items-center justify-between border-b border-zinc-200/50 pb-2.5">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    {r.sport} Rating
                  </span>
                  <Trophy className="h-4 w-4 text-orange-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-orange-500">
                    {Number(r.elo_rating).toFixed(0)}
                  </span>
                  <span className="text-xs text-zinc-400 font-semibold">
                    Peak: {Number(r.elo_peak).toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 text-xs border-t border-zinc-200/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-450 uppercase font-bold tracking-wider">Matches</span>
                    <p className="font-extrabold text-[#111827] mt-0.5 text-sm">{r.total_matches}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-zinc-455 uppercase font-bold tracking-wider">Win Rate</span>
                    <p className="font-extrabold mt-0.5 text-emerald-500 text-sm">{winRate}%</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-zinc-455 uppercase font-bold tracking-wider">Record</span>
                    <p className="font-extrabold mt-0.5 text-zinc-600 text-sm">
                      {r.total_wins}W–{r.total_losses}L
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-1 text-center py-10 rounded-2xl border border-dashed border-zinc-200 text-zinc-400 text-sm bg-zinc-50/50">
            No rating standings computed for this player in Padel or Tennis yet.
          </div>
        )}
      </div>

      {/* ELO Trend Sparkline Chart */}
      {completedMatches.length > 0 && (() => {
        const ratingHistory = [...completedMatches].reverse();
        const startingElo = ratingHistory.length > 0 ? Number((ratingHistory[0] as any).elo_before) : 1000.00;
        const eloPoints = [startingElo, ...ratingHistory.map((mh: any) => Number(mh.elo_after))];
        
        const minElo = Math.min(...eloPoints) - 15;
        const maxElo = Math.max(...eloPoints) + 15;
        const range = maxElo - minElo === 0 ? 1 : maxElo - minElo;

        const w = 800;
        const h = 140;
        const paddingLeft = 40;
        const paddingRight = 30;
        const paddingTop = 20;
        const paddingBottom = 20;

        const plotWidth = w - paddingLeft - paddingRight;
        const plotHeight = h - paddingTop - paddingBottom;

        const coords = eloPoints.map((val, i) => {
          const x = eloPoints.length > 1 
            ? paddingLeft + (i / (eloPoints.length - 1)) * plotWidth
            : w / 2;
          const y = h - paddingBottom - ((val - minElo) / range) * plotHeight;
          return { x, y, val };
        });

        const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
        const areaD = coords.length > 0 
          ? `${lineD} L ${coords[coords.length - 1].x} ${h - paddingBottom} L ${coords[0].x} ${h - paddingBottom} Z`
          : '';

        return (
          <div className="p-6 rounded-2xl border border-zinc-100 bg-zinc-55/70 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-orange-500" />
                ELO Rating Trend History
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Visual progress of Elo rating changes across matches.
              </p>
            </div>

            <div className="relative pt-2">
              <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                <line x1={paddingLeft} y1={paddingTop} x2={w - paddingRight} y2={paddingTop} stroke="#f1f1f4" strokeDasharray="4 4" />
                <line x1={paddingLeft} y1={h - paddingBottom} x2={w - paddingRight} y2={h - paddingBottom} stroke="#e4e4e7" />

                {/* Y-axis labels */}
                <text x={paddingLeft - 8} y={paddingTop + 4} textAnchor="end" className="text-[9px] font-bold fill-zinc-400 tabular-nums">
                  {maxElo.toFixed(0)}
                </text>
                <text x={paddingLeft - 8} y={h - paddingBottom + 4} textAnchor="end" className="text-[9px] font-bold fill-zinc-400 tabular-nums">
                  {minElo.toFixed(0)}
                </text>

                {/* Area under the line */}
                {areaD && <path d={areaD} fill="url(#chartGradient)" />}

                {/* Main line */}
                {lineD && (
                  <path
                    d={lineD}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Plot points */}
                {coords.map((c, i) => (
                  <g key={i} className="group/dot">
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r="4"
                      className="fill-orange-500 stroke-white stroke-2 cursor-pointer transition-all hover:r-6"
                    />
                    <title>{`Match ${i}: ELO ${c.val.toFixed(1)}`}</title>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        );
      })()}

      {/* Match History Log */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Activity className="h-4.5 w-4.5 text-orange-500" />
          Recent Matches History Log
        </h3>

        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
          {completedMatches.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs bg-white/50">
              No completed matches found in this player's session history log.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200/50">
              {completedMatches.map((mh: any) => {
                const isWin =
                  (mh.team === 'A' && mh.match.winner_side === 'A') ||
                  (mh.team === 'B' && mh.match.winner_side === 'B');
                const isDraw = mh.match.winner_side === null;

                const teamNameSelf = mh.team;
                const scoreSelf =
                  teamNameSelf === 'A' ? mh.match.team_a_score : mh.match.team_b_score;
                const scoreOpp =
                  teamNameSelf === 'A' ? mh.match.team_b_score : mh.match.team_a_score;

                const teammate = teammatesMap.get(mh.match.id)?.join(' & ');
                const opponents = opponentsMap.get(mh.match.id)?.join(' & ');

                const delta = Number(mh.elo_delta);

                return (
                  <div
                    key={mh.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-zinc-50 transition-all"
                  >
                    {/* Match Info Column */}
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-zinc-100 text-zinc-500">
                        {mh.match.session?.sport} • R{mh.match.round_number}
                      </span>
                      <p className="text-sm font-extrabold text-[#111827]">
                        {mh.match.session?.session_name}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-medium">
                        {new Date(mh.match.completed_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {/* Matchup Details Column */}
                    <div className="flex-1 max-w-md text-xs text-zinc-500 space-y-1">
                      <p className="font-semibold text-zinc-650">
                        Matchup:{' '}
                        <span className="font-bold text-[#111827]">
                          You {teammate ? `& ${teammate}` : ''}
                        </span>{' '}
                        vs{' '}
                        <span className="font-bold text-[#111827]">
                          {opponents || 'Opponents'}
                        </span>
                      </p>
                      <p className="text-[10px]">
                        Result:{' '}
                        <span
                          className={`font-extrabold uppercase ${
                            isDraw ? 'text-zinc-400' : isWin ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {isDraw ? 'Draw' : isWin ? 'Win' : 'Loss'}
                        </span>{' '}
                        ({scoreSelf} – {scoreOpp})
                      </p>
                    </div>

                    {/* Elo shift Column */}
                    <div className="flex items-center gap-4 text-right shrink-0">
                      <div>
                        <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Rating Shift</span>
                        <div className="flex items-center gap-1 justify-end font-black mt-0.5">
                          {isDraw || delta === 0 ? (
                            <span className="text-zinc-400 text-sm flex items-center gap-0.5">
                              <Minus className="h-3.5 w-3.5" />
                              0.0
                            </span>
                          ) : delta > 0 ? (
                            <span className="text-emerald-500 text-sm flex items-center gap-0.5">
                              <ArrowUpRight className="h-4 w-4" />
                              +{delta.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-rose-500 text-sm flex items-center gap-0.5">
                              <ArrowDownRight className="h-4 w-4" />
                              {delta.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="border-l border-zinc-150 pl-4 w-20">
                        <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">New Elo</span>
                        <span className="font-extrabold text-sm text-orange-500 mt-0.5 block">
                          {Number(mh.elo_after).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
