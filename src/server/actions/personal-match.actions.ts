'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/server/guards';
import { revalidatePath } from 'next/cache';

export type PersonalQuickMatch = {
  id: string;
  activity_name: string;
  sport: string;
  game_type: string;
  scoring_system: string;
  point_target: string;
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
  standings: Array<{ rank: number; playerId: string; name: string; totalPoints: number; wins: number; losses: number; ties: number }>;
  created_at: string;
};

export type SavePersonalQuickMatchPayload = {
  activityName: string;
  sport: string;
  gameType: string;
  scoringSystem: string;
  pointTarget: string;
  players: PersonalQuickMatch['players'];
  matches: PersonalQuickMatch['matches'];
  standings: PersonalQuickMatch['standings'];
};

export async function savePersonalQuickMatchAction(
  payload: SavePersonalQuickMatchPayload
): Promise<{ ok: boolean; message?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from('personal_quick_matches').insert({
    profile_id: profile.id,
    activity_name: payload.activityName,
    sport: payload.sport,
    game_type: payload.gameType,
    scoring_system: payload.scoringSystem,
    point_target: payload.pointTarget,
    players: payload.players,
    matches: payload.matches,
    standings: payload.standings,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath('/communities');
  return { ok: true };
}

export async function getMyQuickMatches(): Promise<PersonalQuickMatch[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('personal_quick_matches')
    .select('id, activity_name, sport, game_type, scoring_system, point_target, players, matches, standings, created_at')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as PersonalQuickMatch[];
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
