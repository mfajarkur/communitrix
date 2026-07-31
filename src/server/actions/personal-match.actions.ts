'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { revalidatePath } from 'next/cache';

export type StoredQuickMatchConfig = {
  sport: string;
  gameType: string;
  activityName: string;
  courtCount: number;
  scoringSystem: string;
  pointTarget: string;
  leaderboardRankedBy: string;
  byeScoringMethod: string;
};

export type PersonalQuickMatch = {
  id: string;
  activity_name: string;
  sport: string;
  game_type: string;
  scoring_system: string;
  point_target: string;
  status: 'OPEN' | 'ENDED';
  version: number;
  config: StoredQuickMatchConfig;
  round_sit_outs: Record<string, string[]>;
  players: Array<{ id: string; name: string; isGuest: boolean; avatarUrl?: string | null }>;
  matches: Array<{
    id: string;
    roundNumber: number;
    courtNumber: number;
    teamA: [string, string];
    teamB: [string, string];
    scoreA: number | null;
    scoreB: number | null;
    isCompleted: boolean;
  }>;
  standings: Array<{
    rank: number;
    playerId: string;
    name: string;
    totalPoints: number;
    wins: number;
    losses: number;
    ties: number;
    pointsWon?: number;
    pointsLost?: number;
    diff?: number;
    realMatchesPlayed?: number;
    byesCount?: number;
  }>;
  created_at: string;
};

export type QuickMatchStatePayload = {
  id?: string;
  // Required whenever id is set — the version this client last read. The update is rejected
  // (treated as a conflict) if the row has since moved on, instead of blindly overwriting it.
  expectedVersion?: number;
  activityName: string;
  sport: string;
  gameType: string;
  scoringSystem: string;
  pointTarget: string;
  config: StoredQuickMatchConfig;
  players: PersonalQuickMatch['players'];
  matches: PersonalQuickMatch['matches'];
  standings: PersonalQuickMatch['standings'];
  roundSitOuts: Record<string, string[]>;
  status: 'OPEN' | 'ENDED';
};

const SELECT_COLUMNS =
  'id, activity_name, sport, game_type, scoring_system, point_target, status, version, config, round_sit_outs, players, matches, standings, created_at';

// Lighter shape for the history list — omits `matches` (the largest field, a full
// round-by-round log) and `config`/`round_sit_outs` (only needed to resume/recap a single
// match), since the list only ever renders name, date, status, player count, and the leader.
export type QuickMatchSummary = Pick<
  PersonalQuickMatch,
  'id' | 'activity_name' | 'sport' | 'game_type' | 'status' | 'players' | 'standings' | 'created_at'
>;

const SUMMARY_COLUMNS = 'id, activity_name, sport, game_type, status, players, standings, created_at';
const HISTORY_LIMIT = 30;

// Creates (id omitted) or updates (id present) a Personal Quick Match's live state. Called
// as soon as the first round is generated (status OPEN, so the session survives a lost
// connection or a dead phone), on every subsequent score/round change, and finally when the
// match is ended (status ENDED).
export async function saveQuickMatchStateAction(
  payload: QuickMatchStatePayload
): Promise<{ ok: boolean; id?: string; version?: number; conflict?: boolean; message?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const row = {
    profile_id: profile.id,
    activity_name: payload.activityName,
    sport: payload.sport,
    game_type: payload.gameType,
    scoring_system: payload.scoringSystem,
    point_target: payload.pointTarget,
    config: payload.config,
    players: payload.players,
    matches: payload.matches,
    standings: payload.standings,
    round_sit_outs: payload.roundSitOuts,
    status: payload.status,
  };

  if (payload.id) {
    const nextVersion = (payload.expectedVersion ?? 0) + 1;
    const { data, error } = await supabase
      .from('personal_quick_matches')
      .update({ ...row, version: nextVersion })
      .eq('id', payload.id)
      .eq('profile_id', profile.id)
      .eq('version', payload.expectedVersion ?? 0)
      .select('id')
      .maybeSingle();

    if (error) return { ok: false, message: error.message };
    if (!data) {
      // No row matched — the version moved on since this client last read it, meaning
      // another tab/device has since written newer data. Don't overwrite it.
      return { ok: false, conflict: true, message: 'This match is open somewhere else and has newer changes.' };
    }
    revalidatePath('/communities');
    return { ok: true, id: payload.id, version: nextVersion };
  }

  const { data, error } = await supabase
    .from('personal_quick_matches')
    .insert({ ...row, version: 1 })
    .select('id')
    .single();

  if (error || !data) return { ok: false, message: error?.message };
  revalidatePath('/communities');
  return { ok: true, id: data.id as string, version: 1 };
}

export async function getMyQuickMatches(): Promise<QuickMatchSummary[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('personal_quick_matches')
    .select(SUMMARY_COLUMNS)
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error || !data) return [];
  return data as unknown as QuickMatchSummary[];
}

export async function getQuickMatchById(id: string): Promise<PersonalQuickMatch | null> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('personal_quick_matches')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as PersonalQuickMatch;
}

export async function deletePersonalQuickMatchAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from('personal_quick_matches')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath('/communities');
  return { ok: true };
}
