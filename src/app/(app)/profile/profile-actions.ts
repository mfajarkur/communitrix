'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';

export type Sport = 'PADEL' | 'TENNIS';

export type PerSportStats = {
  totalMatches: number;
  winRate: number | null;
  peakElo: number | null;
};

export type CommunityStats = {
  communityId: string;
  communityName: string;
  communitySlug: string;
  logoUrl: string | null;
  role: string;
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null;
  cpTotal: number;
  bySport: Partial<Record<Sport, PerSportStats>>;
};

// Same player_rankings/community_points/community_members sources as getMyPerSportStats and
// getMyStatsHighlights (../profile-actions.ts), but kept broken out by community instead of
// summed across every community the caller belongs to — a player active in 3 communities should
// see 3 distinct cards, not one blended "Matches: 47" number that hides which community it
// actually came from.
export async function getMyStatsByCommunity(): Promise<CommunityStats[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from('community_members')
    .select(`
      community_id,
      role,
      skill_level,
      community:communities!community_members_community_id_fkey ( id, name, slug, logo_url )
    `)
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: false });

  const activeMemberships = (memberships || []) as any[];
  if (activeMemberships.length === 0) return [];

  const communityIds = activeMemberships.map((m) => m.community_id);

  const [{ data: rankings }, { data: cpRows }] = await Promise.all([
    supabase
      .from('player_rankings')
      .select('community_id, sport, total_matches, total_wins, elo_peak')
      .eq('profile_id', profile.id)
      .in('community_id', communityIds),
    supabase
      .from('community_points')
      .select('community_id, points_awarded')
      .eq('profile_id', profile.id)
      .in('community_id', communityIds),
  ]);

  const cpByCommunity: Record<string, number> = {};
  (cpRows || []).forEach((r) => {
    cpByCommunity[r.community_id] = (cpByCommunity[r.community_id] || 0) + Number(r.points_awarded || 0);
  });

  return activeMemberships.map((m): CommunityStats => {
    const communityRankings = (rankings || []).filter((r) => r.community_id === m.community_id);
    const bySport: Partial<Record<Sport, PerSportStats>> = {};

    for (const sport of ['PADEL', 'TENNIS'] as Sport[]) {
      const sportRows = communityRankings.filter((r) => r.sport === sport);
      if (sportRows.length === 0) continue;

      const totalMatches = sportRows.reduce((sum, r) => sum + (r.total_matches || 0), 0);
      const totalWins = sportRows.reduce((sum, r) => sum + (r.total_wins || 0), 0);
      const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 1000) / 10 : null;
      const peakElo = Math.max(...sportRows.map((r) => Number(r.elo_peak) || 0));

      bySport[sport] = { totalMatches, winRate, peakElo };
    }

    // Supabase infers this embed as an array even though community_id -> communities is
    // to-one — same pre-existing quirk worked around loosely elsewhere in this codebase.
    const community = Array.isArray(m.community) ? m.community[0] : m.community;

    return {
      communityId: m.community_id,
      communityName: community?.name || 'Community',
      communitySlug: community?.slug || '',
      logoUrl: community?.logo_url ?? null,
      role: m.role,
      skillLevel: m.skill_level ?? null,
      cpTotal: Math.round(cpByCommunity[m.community_id] || 0),
      bySport,
    };
  });
}

export type EloTrendPoint = { date: string; elo: number };
export type EloTrend = { startingElo: number; points: EloTrendPoint[] };

const TREND_WINDOW_DAYS = 90;

// Reconstructs a per-sport Elo trend from existing match history — no history
// table needed. Same match_players -> matches -> sessions join already used
// by the in-community player profile's sparkline (players/[playerId]/page.tsx),
// extended to aggregate across every community the caller belongs to and
// filtered to one sport client-side (mirrors that page's own pattern of
// fetching broadly then filtering/sorting in JS, rather than relying on
// PostgREST nested-embed filters that have no other precedent in this repo).
export async function getMyEloTrend(sport: Sport): Promise<EloTrend> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from('community_members')
    .select('community_id')
    .eq('profile_id', profile.id)
    .eq('is_active', true);

  const communityIds = (memberships || []).map((m) => m.community_id);
  if (communityIds.length === 0) return { startingElo: 1000, points: [] };

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - TREND_WINDOW_DAYS);

  const { data: rawHistory } = await supabase
    .from('match_players')
    .select(`
      elo_before,
      elo_after,
      match:matches (
        status,
        completed_at,
        session:sessions ( sport )
      )
    `)
    .eq('profile_id', profile.id)
    .in('community_id', communityIds);

  const completed = ((rawHistory || []) as any[])
    .filter(
      (mh) =>
        mh.match?.status === 'COMPLETED' &&
        mh.match?.session?.sport === sport &&
        mh.match?.completed_at &&
        new Date(mh.match.completed_at) >= windowStart
    )
    .sort((a, b) => new Date(a.match.completed_at).getTime() - new Date(b.match.completed_at).getTime());

  if (completed.length === 0) return { startingElo: 1000, points: [] };

  const startingElo = Number(completed[0].elo_before);
  const points: EloTrendPoint[] = completed.map((mh) => ({
    date: mh.match.completed_at,
    elo: Number(mh.elo_after),
  }));

  return { startingElo, points };
}
