import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lzzzjtijagandsrodaaj.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var. Set it in .env.local (gitignored) before running this script.');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

async function debugPageData() {
  const { data: community } = await adminClient.from('communities').select('*').eq('slug', 'komunitas-dummy').single();

  const { data: members } = await adminClient
    .from('community_members')
    .select(`
      role,
      is_active,
      joined_at,
      profile:profiles (
        id,
        full_name,
        display_name,
        username,
        is_guest,
        avatar_url
      )
    `)
    .eq('community_id', community.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true });

  const activeMembers = members || [];

  const { data: allRankings, error: rankError } = await adminClient
    .from('player_rankings')
    .select(`
      id,
      profile_id,
      sport,
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
        display_name,
        username,
        is_guest,
        avatar_url
      )
    `)
    .eq('community_id', community.id)
    .order('elo_rating', { ascending: false });

  console.log("Rankings query error:", rankError);
  console.log("Rankings count fetched:", allRankings ? allRankings.length : 0);

  const rawRankings = allRankings || [];
  const sportName = 'PADEL';
  const sportRankings = rawRankings.filter((r) => r.sport === sportName);
  const map = new Map(sportRankings.map((r) => [r.profile_id || r.profile?.id, r]));

  let matchCount = 0;
  const leaderboard = activeMembers
    .filter((m) => m.profile)
    .map((m) => {
      const existing = map.get(m.profile.id);
      if (existing) {
        matchCount++;
        return {
          ...existing,
          profile: existing.profile || m.profile,
        };
      }
      return {
        id: `default-${sportName}-${m.profile.id}`,
        sport: sportName,
        elo_rating: 1000,
        profile: m.profile,
      };
    })
    .sort((a, b) => Number(b.elo_rating) - Number(a.elo_rating));

  console.log(`Matched ${matchCount} rankings out of ${activeMembers.length} active members!`);
  console.log("\n🏆 TOP 5 LEADERBOARD ITEMS:");
  leaderboard.slice(0, 5).forEach((item, idx) => {
    console.log(` #${idx + 1} ${item.profile.full_name}: ELO ${item.elo_rating} (Wins: ${item.total_wins}, Matches: ${item.total_matches})`);
  });
}

debugPageData().catch(console.error);
