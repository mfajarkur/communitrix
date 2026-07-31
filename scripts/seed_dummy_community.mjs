import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lzzzjtijagandsrodaaj.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var. Set it in .env.local (gitignored) before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function toTitleCase(str) {
  if (!str) return '';
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const DUMMY_NAMES = [
  "Aditya Nugroho", "Ahmad Fauzi", "Aisyah Putri", "Alexander Wright", "Amalia Nabila",
  "Andi Wijaya", "Anisa Rahma", "Aria Pratama", "Aris Budiman", "Bagus Setiawan",
  "Bambang Pamungkas", "Bayu Skak", "Budi Santoso", "Bintang Ramadan", "Charles Leclerc",
  "Clara Amanda", "Daniel Hartono", "Deden Irwan", "Deni Sumargo", "Desi Ratnasari",
  "Dewi Lestari", "Dian Sastrowardoyo", "Doni Monardo", "Dwi Cahyono", "Eko Prasetyo",
  "Elina Joerg", "Endah Larasati", "Fadil Jaidi", "Fajar Kurniawan", "Farhan Akhtar",
  "Febri Hariyadi", "Fitri Carlina", "Gadis Sampul", "Gibran Rakabuming", "Gilang Dirga",
  "Gita Gutawa", "Hafiz Indonesia", "Hanan Attaki", "Hary Tanoe", "Hendrik Ceper",
  "Hesti Purwadinata", "Ibrahim Rasyid", "Irfan Bachdim", "Indra Sjafri", "Ira Wibowo",
  "Isyana Sarasvati", "Jajang C Noer", "Jefri Nichol", "Joko Widodo", "Jonathan Christie",
  "Kartika Putri", "Kinan Saputra", "Krisdayanti", "Lesty Kejora", "Lukman Sardi",
  "Mulan Jameela", "Nabila Syakieb", "Nadiem Makarim", "Najwa Shihab", "Nazaruddin",
  "Niken Salindry", "Novia Bachmid", "Oky Setiana Dewi", "Onadio Leonardo", "Prabowo Subianto",
  "Prilly Latuconsina", "Raditya Dika", "Raffi Ahmad", "Raisa Andriana", "Raline Shah",
  "Reza Rahadian", "Ria Ricis", "Rizky Febian", "Rosa Lina", "Ruben Onsu",
  "Sandrina Azzahra", "Siti Badriah", "Soleh Solihun", "SpongeBob SquarePants", "Sule Prikitiw",
  "Syahrini", "Tantri Syalindri", "Titi Kamal", "Tora Sudiro", "Uus Stand Up",
  "Vidi Aldiano", "Via Vallen", "Wika Salim", "Yovie Widianto", "Yura Yunita",
  "Zaskia Gotik", "Zulham Zamrun", "Carlos Alcaraz", "Rafael Nadal", "Novak Djokovic",
  "Roger Federer", "Jannik Sinner", "Aryna Sabalenka", "Iga Swiatek", "Elena Rybakina"
];

async function seedDummyCommunity() {
  console.log("🌱 Starting seed for 'Komunitas Dummy' (100 Members)...");

  // 1. Fetch authenticated profiles to add as ADMIN
  const { data: profilesList } = await supabase.from('profiles').select('id, full_name').not('auth_user_id', 'is', null);
  const creatorProfileId = profilesList && profilesList.length > 0 ? profilesList[0].id : null;
  
  // 2. Create Community
  const communitySlug = 'komunitas-dummy';
  
  // Clean existing dummy community if exists
  const { data: existingComm } = await supabase.from('communities').select('id').eq('slug', communitySlug).maybeSingle();
  if (existingComm) {
    console.log(`⚠️ Removing previous '${communitySlug}' community...`);
    await supabase.from('communities').delete().eq('id', existingComm.id);
  }

  const { data: newComm, error: commError } = await supabase
    .from('communities')
    .insert({
      name: 'Komunitas Dummy',
      slug: communitySlug,
      default_sport: 'PADEL',
      settings: {
        description: 'Komunitas simulasi testing 100 anggota dengan ELO rating, statistik, sesi game live, dan klasemen komprehensif.'
      },
      join_code: 'DUMMY100',
      join_code_enabled: true,
      created_by: creatorProfileId,
    })
    .select()
    .single();

  if (commError || !newComm) {
    console.error("❌ Error creating community:", commError);
    return;
  }

  console.log(`✅ Created Community: ${newComm.name} (ID: ${newComm.id})`);

  // 3. Create 100 Guest Profiles
  const profileInserts = DUMMY_NAMES.map((name, idx) => ({
    full_name: toTitleCase(name),
    display_name: toTitleCase(name),
    created_at: new Date(Date.now() - (100 - idx) * 86400000 * 2).toISOString(),
  }));

  const { data: createdProfiles, error: profError } = await supabase
    .from('profiles')
    .insert(profileInserts)
    .select('id, full_name');

  if (profError || !createdProfiles) {
    console.error("❌ Error creating guest profiles:", profError);
    return;
  }

  console.log(`✅ Created ${createdProfiles.length} player profiles.`);

  // 4. Create Community Memberships
  const memberInserts = createdProfiles.map((p, idx) => {
    let role = 'MEMBER';
    if (idx === 0) role = 'ADMIN';
    else if (idx >= 1 && idx <= 5) role = 'HOST';

    return {
      community_id: newComm.id,
      profile_id: p.id,
      role: role,
      is_active: true,
      joined_at: new Date(Date.now() - (100 - idx) * 86400000).toISOString(),
    };
  });

  // Ensure all actual logged in profiles are also ADMINs so user can view/manage
  if (profilesList && profilesList.length > 0) {
    profilesList.forEach(p => {
      if (!createdProfiles.some(cp => cp.id === p.id)) {
        memberInserts.push({
          community_id: newComm.id,
          profile_id: p.id,
          role: 'ADMIN',
          is_active: true,
          joined_at: new Date().toISOString(),
        });
      }
    });
  }

  const { error: memError } = await supabase.from('community_members').insert(memberInserts);
  if (memError) console.error("❌ Error inserting members:", memError);
  else console.log(`✅ Inserted ${memberInserts.length} community members.`);

  // 5. Create Diverse Player Rankings (ELO Rating System)
  const rankingInserts = [];

  createdProfiles.forEach((p, idx) => {
    // Generate ELO between 850 and 1920
    const baseElo = Math.round(1920 - (idx * 10.7) + (Math.random() * 40 - 20));
    const eloRating = Math.max(850, Math.min(2100, baseElo));
    const eloPeak = Math.max(eloRating, Math.round(eloRating + Math.random() * 80));

    const totalMatches = Math.floor(Math.random() * 45) + 5;
    const winRatio = 0.35 + ((eloRating - 850) / 1100) * 0.45;
    const totalWins = Math.max(1, Math.round(totalMatches * winRatio));
    const totalLosses = Math.max(0, totalMatches - totalWins);

    const avgPointsFor = 18 + Math.floor(Math.random() * 4);
    const avgPointsAgainst = 14 + Math.floor(Math.random() * 4);
    const pointsFor = totalWins * avgPointsFor + totalLosses * 12;
    const pointsAgainst = totalWins * 12 + totalLosses * avgPointsAgainst;

    rankingInserts.push({
      community_id: newComm.id,
      profile_id: p.id,
      sport: 'PADEL',
      elo_rating: eloRating,
      elo_peak: eloPeak,
      total_matches: totalMatches,
      total_wins: totalWins,
      total_losses: totalLosses,
      total_draws: 0,
      points_for: pointsFor,
      points_against: pointsAgainst,
    });
  });

  const { error: rankError } = await supabase.from('player_rankings').insert(rankingInserts);
  if (rankError) console.error("❌ Error inserting rankings:", rankError);
  else console.log(`✅ Inserted 100 ELO standings records for PADEL.`);

  // 6. Create Sessions History
  const sessionInserts = [
    {
      community_id: newComm.id,
      session_name: 'Padel Weekend Championship #1',
      sport: 'PADEL',
      format: 'AMERICANO',
      scoring_type: 'POINTS',
      court_count: 4,
      points_mode: 'FIRST_TO_TARGET',
      max_score_target: 24,
      created_by: creatorProfileId || createdProfiles[0].id,
      status: 'COMPLETED',
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      community_id: newComm.id,
      session_name: 'Mexicano Night League Round 2',
      sport: 'PADEL',
      format: 'MEXICANO',
      scoring_type: 'POINTS',
      court_count: 3,
      points_mode: 'FIRST_TO_TARGET',
      max_score_target: 24,
      created_by: creatorProfileId || createdProfiles[0].id,
      status: 'COMPLETED',
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      community_id: newComm.id,
      session_name: 'Sunday Live Open Play Session',
      sport: 'PADEL',
      format: 'MEXICANO',
      scoring_type: 'POINTS',
      court_count: 4,
      points_mode: 'FIRST_TO_TARGET',
      max_score_target: 24,
      created_by: creatorProfileId || createdProfiles[0].id,
      status: 'ACTIVE',
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
  ];

  const { data: createdSessions, error: sessError } = await supabase.from('sessions').insert(sessionInserts).select();
  if (sessError) console.error("❌ Error inserting sessions:", sessError);
  else console.log(`✅ Created 3 Game Sessions (2 Completed, 1 Active Live).`);

  // 7. Add Session Players & Matches for Active/Completed Sessions
  if (createdSessions && createdSessions.length > 0) {
    for (const sess of createdSessions) {
      const sessionPlayerInserts = createdProfiles.slice(0, 16).map(p => ({
        session_id: sess.id,
        profile_id: p.id,
      }));
      await supabase.from('session_players').insert(sessionPlayerInserts);

      if (sess.status === 'COMPLETED') {
        const matchInserts = [
          {
            session_id: sess.id,
            community_id: newComm.id,
            sport: 'PADEL',
            round_number: 1,
            court_number: 1,
            team_a_player1_id: createdProfiles[0].id,
            team_a_player2_id: createdProfiles[3].id,
            team_b_player1_id: createdProfiles[1].id,
            team_b_player2_id: createdProfiles[2].id,
            score_a: 14,
            score_b: 10,
            status: 'COMPLETED',
          },
          {
            session_id: sess.id,
            community_id: newComm.id,
            sport: 'PADEL',
            round_number: 1,
            court_number: 2,
            team_a_player1_id: createdProfiles[4].id,
            team_a_player2_id: createdProfiles[7].id,
            team_b_player1_id: createdProfiles[5].id,
            team_b_player2_id: createdProfiles[6].id,
            score_a: 18,
            score_b: 6,
            status: 'COMPLETED',
          },
        ];
        await supabase.from('matches').insert(matchInserts);
      }
    }
  }

  console.log("\n🎉 DUMMY COMMUNITY SEED COMPLETE!");
  console.log(`📌 Slug URL: /c/komunitas-dummy`);
  console.log(`📌 Join Code: DUMMY100`);
}

seedDummyCommunity().catch(console.error);
