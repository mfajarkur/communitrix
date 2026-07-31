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

const DUMMY_PLAYERS = [
  { name: "Aditya Nugroho", gender: "MALE" },
  { name: "Ahmad Fauzi", gender: "MALE" },
  { name: "Aisyah Putri", gender: "FEMALE" },
  { name: "Alexander Wright", gender: "MALE" },
  { name: "Amalia Nabila", gender: "FEMALE" },
  { name: "Andi Wijaya", gender: "MALE" },
  { name: "Anisa Rahma", gender: "FEMALE" },
  { name: "Aria Pratama", gender: "MALE" },
  { name: "Aris Budiman", gender: "MALE" },
  { name: "Bagus Setiawan", gender: "MALE" },
  { name: "Bambang Pamungkas", gender: "MALE" },
  { name: "Bayu Skak", gender: "MALE" },
  { name: "Budi Santoso", gender: "MALE" },
  { name: "Bintang Ramadan", gender: "MALE" },
  { name: "Charles Leclerc", gender: "MALE" },
  { name: "Clara Amanda", gender: "FEMALE" },
  { name: "Daniel Hartono", gender: "MALE" },
  { name: "Deden Irwan", gender: "MALE" },
  { name: "Deni Sumargo", gender: "MALE" },
  { name: "Desi Ratnasari", gender: "FEMALE" },
  { name: "Dewi Lestari", gender: "FEMALE" },
  { name: "Dian Sastrowardoyo", gender: "FEMALE" },
  { name: "Doni Monardo", gender: "MALE" },
  { name: "Dwi Cahyono", gender: "MALE" },
  { name: "Eko Prasetyo", gender: "MALE" },
  { name: "Elina Joerg", gender: "FEMALE" },
  { name: "Endah Larasati", gender: "FEMALE" },
  { name: "Fadil Jaidi", gender: "MALE" },
  { name: "Fajar Kurniawan", gender: "MALE" },
  { name: "Farhan Akhtar", gender: "MALE" },
  { name: "Febri Hariyadi", gender: "MALE" },
  { name: "Fitri Carlina", gender: "FEMALE" },
  { name: "Gadis Sampul", gender: "FEMALE" },
  { name: "Gibran Rakabuming", gender: "MALE" },
  { name: "Gilang Dirga", gender: "MALE" },
  { name: "Gita Gutawa", gender: "FEMALE" },
  { name: "Hafiz Indonesia", gender: "MALE" },
  { name: "Hanan Attaki", gender: "MALE" },
  { name: "Hary Tanoe", gender: "MALE" },
  { name: "Hendrik Ceper", gender: "MALE" },
  { name: "Hesti Purwadinata", gender: "FEMALE" },
  { name: "Ibrahim Rasyid", gender: "MALE" },
  { name: "Irfan Bachdim", gender: "MALE" },
  { name: "Indra Sjafri", gender: "MALE" },
  { name: "Ira Wibowo", gender: "FEMALE" },
  { name: "Isyana Sarasvati", gender: "FEMALE" },
  { name: "Jajang C Noer", gender: "FEMALE" },
  { name: "Jefri Nichol", gender: "MALE" },
  { name: "Joko Widodo", gender: "MALE" },
  { name: "Jonathan Christie", gender: "MALE" },
  { name: "Kartika Putri", gender: "FEMALE" },
  { name: "Kinan Saputra", gender: "MALE" },
  { name: "Krisdayanti", gender: "FEMALE" },
  { name: "Lesty Kejora", gender: "FEMALE" },
  { name: "Lukman Sardi", gender: "MALE" },
  { name: "Mulan Jameela", gender: "FEMALE" },
  { name: "Nabila Syakieb", gender: "FEMALE" },
  { name: "Nadiem Makarim", gender: "MALE" },
  { name: "Najwa Shihab", gender: "FEMALE" },
  { name: "Nazaruddin", gender: "MALE" },
  { name: "Niken Salindry", gender: "FEMALE" },
  { name: "Novia Bachmid", gender: "FEMALE" },
  { name: "Oky Setiana Dewi", gender: "FEMALE" },
  { name: "Onadio Leonardo", gender: "MALE" },
  { name: "Prabowo Subianto", gender: "MALE" },
  { name: "Prilly Latuconsina", gender: "FEMALE" },
  { name: "Raditya Dika", gender: "MALE" },
  { name: "Raffi Ahmad", gender: "MALE" },
  { name: "Raisa Andriana", gender: "FEMALE" },
  { name: "Raline Shah", gender: "FEMALE" },
  { name: "Reza Rahadian", gender: "MALE" },
  { name: "Ria Ricis", gender: "FEMALE" },
  { name: "Rizky Febian", gender: "MALE" },
  { name: "Rosa Lina", gender: "FEMALE" },
  { name: "Ruben Onsu", gender: "MALE" },
  { name: "Sandrina Azzahra", gender: "FEMALE" },
  { name: "Siti Badriah", gender: "FEMALE" },
  { name: "Soleh Solihun", gender: "MALE" },
  { name: "SpongeBob SquarePants", gender: "MALE" },
  { name: "Sule Prikitiw", gender: "MALE" },
  { name: "Syahrini", gender: "FEMALE" },
  { name: "Tantri Syalindri", gender: "FEMALE" },
  { name: "Titi Kamal", gender: "FEMALE" },
  { name: "Tora Sudiro", gender: "MALE" },
  { name: "Uus Stand Up", gender: "MALE" },
  { name: "Vidi Aldiano", gender: "MALE" },
  { name: "Via Vallen", gender: "FEMALE" },
  { name: "Wika Salim", gender: "FEMALE" },
  { name: "Yovie Widianto", gender: "MALE" },
  { name: "Yura Yunita", gender: "FEMALE" },
  { name: "Zaskia Gotik", gender: "FEMALE" },
  { name: "Zulham Zamrun", gender: "MALE" },
  { name: "Carlos Alcaraz", gender: "MALE" },
  { name: "Rafael Nadal", gender: "MALE" },
  { name: "Novak Djokovic", gender: "MALE" },
  { name: "Roger Federer", gender: "MALE" },
  { name: "Jannik Sinner", gender: "MALE" },
  { name: "Aryna Sabalenka", gender: "FEMALE" },
  { name: "Iga Swiatek", gender: "FEMALE" },
  { name: "Elena Rybakina", gender: "FEMALE" }
];

function calculateMatchElo(teamA, teamB, scoreA, scoreB, attendeeCount, courtCount = 4) {
  const K_PROVISIONAL = 48;
  const K_BASE = 24;

  const activeCount = Math.max(attendeeCount, 1);
  const playingSlots = Math.min(Math.floor(activeCount / 4), courtCount) * 4;
  const expectedMatches = Math.max(Math.floor((playingSlots / activeCount) * 8), 1);
  const formatDamping = 1 / Math.sqrt(expectedMatches);

  const avgRatingA = (teamA[0].elo + teamA[1].elo) / 2;
  const avgRatingB = (teamB[0].elo + teamB[1].elo) / 2;

  const gapA = Math.abs(teamA[0].elo - teamA[1].elo);
  const gapB = Math.abs(teamB[0].elo - teamB[1].elo);

  const effRatingA = avgRatingA - 0.25 * gapA;
  const effRatingB = avgRatingB - 0.25 * gapB;

  const expectedScoreA = 1 / (1 + Math.pow(10, (effRatingB - effRatingA) / 400));

  let wA = 0.5;
  if (scoreA > scoreB) wA = 1.0;
  else if (scoreB > scoreA) wA = 0.0;

  const margin = Math.abs(scoreA - scoreB);
  const mov = Math.log(margin + 1) * (2.2 / ((effRatingA - effRatingB) * 0.001 + 2.2));

  const allPlayers = [...teamA, ...teamB];
  const meanK = allPlayers.reduce((sum, p) => {
    const kBaseVal = p.matches < 10 ? K_PROVISIONAL : K_BASE;
    return sum + kBaseVal * formatDamping;
  }, 0) / 4;

  const deltaA = meanK * mov * (wA - expectedScoreA);
  const deltaB = -deltaA;

  return { deltaA, deltaB };
}

async function runFullTournamentSimulation() {
  console.log("🚀 Starting Full 100-Player Tournament Simulation with Gender Attributes...");

  const { data: profilesList } = await supabase.from('profiles').select('id').not('auth_user_id', 'is', null);
  const adminId = profilesList && profilesList.length > 0 ? profilesList[0].id : null;

  const communitySlug = 'komunitas-dummy';
  const { data: existingComm } = await supabase.from('communities').select('id').eq('slug', communitySlug).maybeSingle();
  if (existingComm) {
    console.log(`🧹 Cleaning existing '${communitySlug}' data...`);
    await supabase.from('communities').delete().eq('id', existingComm.id);
  }

  const { data: newComm, error: commError } = await supabase
    .from('communities')
    .insert({
      name: 'Komunitas Dummy',
      slug: communitySlug,
      default_sport: 'PADEL',
      settings: {
        description: 'Komunitas simulasi testing 100 anggota dengan atribut gender, 1,200+ pertandingan real, ELO rating dinamis, dan Wall of Fame.'
      },
      join_code: 'DUMMY100',
      join_code_enabled: true,
      created_by: adminId,
    })
    .select()
    .single();

  if (commError || !newComm) {
    console.error("❌ Failed to create community:", commError);
    return;
  }

  const profileInserts = DUMMY_PLAYERS.map((item, idx) => ({
    full_name: toTitleCase(item.name),
    display_name: toTitleCase(item.name),
    gender: item.gender,
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  }));

  let { data: createdProfiles, error: profError } = await supabase
    .from('profiles')
    .insert(profileInserts)
    .select('id, full_name, gender');

  if (profError && profError.message?.includes('gender')) {
    console.log("⚠️ Remote DB profiles table missing 'gender' column, creating profiles without gender payload...");
    const fallbackInserts = profileInserts.map(({ gender, ...rest }) => rest);
    const fallbackRes = await supabase
      .from('profiles')
      .insert(fallbackInserts)
      .select('id, full_name');
    createdProfiles = fallbackRes.data;
    profError = fallbackRes.error;
  }

  if (profError || !createdProfiles) {
    console.error("❌ Failed to create profiles:", profError);
    return;
  }

  const memberInserts = createdProfiles.map((p, idx) => ({
    community_id: newComm.id,
    profile_id: p.id,
    role: idx === 0 ? 'ADMIN' : idx <= 5 ? 'HOST' : 'MEMBER',
    is_active: true,
    joined_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  }));

  if (adminId && !createdProfiles.some(cp => cp.id === adminId)) {
    memberInserts.push({
      community_id: newComm.id,
      profile_id: adminId,
      role: 'ADMIN',
      is_active: true,
      joined_at: new Date().toISOString(),
    });
  }

  await supabase.from('community_members').insert(memberInserts);

  const playerStats = new Map();
  createdProfiles.forEach((p) => {
    playerStats.set(p.id, {
      id: p.id,
      name: p.full_name,
      gender: p.gender,
      elo: 1000.0,
      peakElo: 1000.0,
      matches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  });

  const NUM_SESSIONS = 25;
  const MATCHES_PER_SESSION = 50;
  let totalMatchesSimulated = 0;

  for (let sIdx = 1; sIdx <= NUM_SESSIONS; sIdx++) {
    const isMexicano = sIdx % 2 === 0;
    const formatName = isMexicano ? 'MEXICANO' : 'AMERICANO';
    const sessionDate = new Date(Date.now() - (NUM_SESSIONS - sIdx) * 3.5 * 86400000);
    const sessionStatus = sIdx === NUM_SESSIONS ? 'ACTIVE' : 'COMPLETED';

    const { data: sessionData } = await supabase
      .from('sessions')
      .insert({
        community_id: newComm.id,
        session_name: `Communitrix ${formatName} Open #${sIdx}`,
        sport: 'PADEL',
        format: formatName,
        scoring_type: 'POINTS',
        court_count: 4,
        points_mode: 'FIRST_TO_TARGET',
        max_score_target: 24,
        created_by: adminId || createdProfiles[0].id,
        status: sessionStatus,
        created_at: sessionDate.toISOString(),
      })
      .select()
      .single();

    if (!sessionData) continue;

    const attendeeCount = 28;
    const sessionAttendees = [...createdProfiles].sort(() => Math.random() - 0.5).slice(0, attendeeCount);

    const sPlayerInserts = sessionAttendees.map((p) => ({
      session_id: sessionData.id,
      profile_id: p.id,
    }));
    await supabase.from('session_players').insert(sPlayerInserts);

    const matchInserts = [];
    for (let mIdx = 1; mIdx <= MATCHES_PER_SESSION; mIdx++) {
      const matchPlayers = [...sessionAttendees].sort(() => Math.random() - 0.5).slice(0, 4);
      const p1 = playerStats.get(matchPlayers[0].id);
      const p2 = playerStats.get(matchPlayers[1].id);
      const p3 = playerStats.get(matchPlayers[2].id);
      const p4 = playerStats.get(matchPlayers[3].id);

      const teamA = [p1, p2];
      const teamB = [p3, p4];

      const winnerA = Math.random() > 0.45;
      const scoreA = winnerA ? 24 : Math.floor(Math.random() * 10) + 12;
      const scoreB = winnerA ? Math.floor(Math.random() * 10) + 12 : 24;

      const { deltaA, deltaB } = calculateMatchElo(teamA, teamB, scoreA, scoreB, attendeeCount, 4);

      const individualDeltaA = deltaA / 2;
      teamA.forEach((p) => {
        p.elo = Math.max(100.0, Number((p.elo + individualDeltaA).toFixed(2)));
        p.peakElo = Math.max(p.peakElo, p.elo);
        p.matches += 1;
        p.pointsFor += scoreA;
        p.pointsAgainst += scoreB;
        if (scoreA > scoreB) p.wins += 1;
        else p.losses += 1;
      });

      const individualDeltaB = deltaB / 2;
      teamB.forEach((p) => {
        p.elo = Math.max(100.0, Number((p.elo + individualDeltaB).toFixed(2)));
        p.peakElo = Math.max(p.peakElo, p.elo);
        p.matches += 1;
        p.pointsFor += scoreB;
        p.pointsAgainst += scoreA;
        if (scoreB > scoreA) p.wins += 1;
        else p.losses += 1;
      });

      totalMatchesSimulated += 1;

      matchInserts.push({
        session_id: sessionData.id,
        community_id: newComm.id,
        sport: 'PADEL',
        round_number: Math.ceil(mIdx / 4),
        court_number: ((mIdx - 1) % 4) + 1,
        team_a_player1_id: p1.id,
        team_a_player2_id: p2.id,
        team_b_player1_id: p3.id,
        team_b_player2_id: p4.id,
        score_a: scoreA,
        score_b: scoreB,
        status: 'COMPLETED',
        created_at: new Date(sessionDate.getTime() + mIdx * 600000).toISOString(),
      });
    }

    await supabase.from('matches').insert(matchInserts);
  }

  const rankingInserts = [];
  playerStats.forEach((p) => {
    rankingInserts.push({
      community_id: newComm.id,
      profile_id: p.id,
      sport: 'PADEL',
      elo_rating: p.elo,
      elo_peak: p.peakElo,
      total_matches: p.matches,
      total_wins: p.wins,
      total_losses: p.losses,
      total_draws: p.draws,
      points_for: p.pointsFor,
      points_against: p.pointsAgainst,
    });
  });

  await supabase.from('player_rankings').insert(rankingInserts);
  console.log(`🎉 SIMULATION COMPLETE! 100 Players seeded with Gender attributes.`);
}

runFullTournamentSimulation().catch(console.error);
