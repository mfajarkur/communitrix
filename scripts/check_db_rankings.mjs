import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lzzzjtijagandsrodaaj.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var. Set it in .env.local (gitignored) before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkDb() {
  console.log("🔍 Checking 'komunitas-dummy' in remote database...");

  const { data: comm } = await supabase.from('communities').select('*').eq('slug', 'komunitas-dummy').single();
  if (!comm) {
    console.log("❌ Community 'komunitas-dummy' NOT FOUND!");
    return;
  }
  console.log("✅ Community ID:", comm.id);

  const { data: rankings, error: rErr } = await supabase
    .from('player_rankings')
    .select('id, profile_id, sport, elo_rating, total_matches, total_wins')
    .eq('community_id', comm.id);

  console.log(`📊 Found ${rankings ? rankings.length : 0} ranking records for community.`);
  if (rankings && rankings.length > 0) {
    console.log("Sample top 5 rankings from DB:", rankings.slice(0, 5));
  } else {
    console.log("Error fetching rankings:", rErr);
  }
}

checkDb().catch(console.error);
