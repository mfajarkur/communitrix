'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';

export type Sport = 'PADEL' | 'TENNIS';

export type PerSportStats = {
  totalMatches: number;
  winRate: number | null;
  peakElo: number | null;
};

export async function getMyPerSportStats(): Promise<Record<Sport, PerSportStats | null>> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: rankings } = await supabase
    .from('player_rankings')
    .select('sport, total_matches, total_wins, elo_peak')
    .eq('profile_id', profile.id);

  const rows = rankings || [];
  const bySport: Record<Sport, PerSportStats | null> = { PADEL: null, TENNIS: null };

  for (const sport of ['PADEL', 'TENNIS'] as Sport[]) {
    const sportRows = rows.filter((r) => r.sport === sport);
    if (sportRows.length === 0) continue;

    const totalMatches = sportRows.reduce((sum, r) => sum + (r.total_matches || 0), 0);
    const totalWins = sportRows.reduce((sum, r) => sum + (r.total_wins || 0), 0);
    const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 1000) / 10 : null;
    const peakElo = Math.max(...sportRows.map((r) => Number(r.elo_peak) || 0));

    bySport[sport] = { totalMatches, winRate, peakElo };
  }

  return bySport;
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
