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

// Fails loudly instead of letting a broken insert pass silently (the bug that shipped
// 25 sessions with zero rounds/matches/session_players the first time this script ran).
function assertNoError(error, label) {
  if (error) {
    console.error(`❌ ${label}:`, error);
    throw new Error(`${label}: ${error.message}`);
  }
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

const NUM_SESSIONS = 25;
const MATCHES_PER_SESSION = 50;
const COURT_COUNT = 4;
const ATTENDEE_COUNT = 28;

async function runFullTournamentSimulation() {
  console.log("🚀 Starting Full 100-Player Tournament Simulation with Gender Attributes...");

  // All real (auth-backed) profiles get ADMIN on the dummy community below — we don't know
  // in advance which real account will actually be used to test it, so don't guess by
  // picking just the first one (that caused the community's actual owner to have zero
  // membership in a previous run of this script).
  const { data: profilesList } = await supabase.from('profiles').select('id').not('auth_user_id', 'is', null);
  const realProfileIds = (profilesList || []).map((p) => p.id);
  const adminId = realProfileIds.length > 0 ? realProfileIds[0] : null;

  const communitySlug = 'komunitas-dummy';
  const { data: existingComm } = await supabase.from('communities').select('id').eq('slug', communitySlug).maybeSingle();
  if (existingComm) {
    console.log(`🧹 Cleaning existing '${communitySlug}' data...`);
    const { error: delErr } = await supabase.from('communities').delete().eq('id', existingComm.id);
    assertNoError(delErr, 'Failed to delete existing dummy community');
  }

  const { data: newComm, error: commError } = await supabase
    .from('communities')
    .insert({
      name: 'Komunitas Dummy',
      slug: communitySlug,
      default_sport: 'PADEL',
      settings: {
        description: 'Komunitas simulasi testing 100 anggota dengan atribut gender, 1,200 pertandingan real (24 sesi selesai), ELO rating dinamis, dan 1 sesi masih ACTIVE (open) untuk uji coba Live Board.'
      },
      join_code: 'DUMMY100',
      join_code_enabled: true,
      created_by: adminId,
    })
    .select()
    .single();

  assertNoError(commError, 'Failed to create community');

const MALE_SPORTS_AVATARS = [
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&auto=format&fit=crop&q=80"
];

const FEMALE_SPORTS_AVATARS = [
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1548142813-c348350df52b?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=200&auto=format&fit=crop&q=80"
];

  let maleIdx = 0;
  let femaleIdx = 0;
  const profileInserts = DUMMY_PLAYERS.map((item) => {
    let avatarUrl = '';
    if (item.gender === 'FEMALE') {
      avatarUrl = FEMALE_SPORTS_AVATARS[femaleIdx % FEMALE_SPORTS_AVATARS.length];
      femaleIdx++;
    } else {
      avatarUrl = MALE_SPORTS_AVATARS[maleIdx % MALE_SPORTS_AVATARS.length];
      maleIdx++;
    }
    return {
      full_name: toTitleCase(item.name),
      display_name: toTitleCase(item.name),
      gender: item.gender,
      avatar_url: avatarUrl,
      created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    };
  });

  const { data: createdProfiles, error: profError } = await supabase
    .from('profiles')
    .insert(profileInserts)
    .select('id, full_name, gender');

  assertNoError(profError, 'Failed to create profiles');

  const memberInserts = createdProfiles.map((p, idx) => ({
    community_id: newComm.id,
    profile_id: p.id,
    role: idx === 0 ? 'ADMIN' : idx <= 5 ? 'HOST' : 'MEMBER',
    is_active: true,
    joined_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  }));

  // Give every real account ADMIN on the dummy community, not just one guessed profile.
  for (const realId of realProfileIds) {
    if (!createdProfiles.some((cp) => cp.id === realId)) {
      memberInserts.push({
        community_id: newComm.id,
        profile_id: realId,
        role: 'ADMIN',
        is_active: true,
        joined_at: new Date().toISOString(),
      });
    }
  }

  const { error: memberErr } = await supabase.from('community_members').insert(memberInserts);
  assertNoError(memberErr, 'Failed to create community_members');

  // Global per-player Elo/stat state, carried across sessions in chronological order.
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

  let totalMatchesSimulated = 0;

  for (let sIdx = 1; sIdx <= NUM_SESSIONS; sIdx++) {
    const isMexicano = sIdx % 2 === 0;
    const formatName = isMexicano ? 'MEXICANO' : 'AMERICANO';
    const sessionDate = new Date(Date.now() - (NUM_SESSIONS - sIdx) * 3.5 * 86400000);
    const isLastSession = sIdx === NUM_SESSIONS;
    const sessionStatus = isLastSession ? 'ACTIVE' : 'COMPLETED';

    const { data: sessionData, error: sessErr } = await supabase
      .from('sessions')
      .insert({
        community_id: newComm.id,
        session_name: `Communitrix ${formatName} Open #${sIdx}`,
        sport: 'PADEL',
        format: formatName,
        scoring_type: 'POINTS',
        court_count: COURT_COUNT,
        points_mode: 'FIRST_TO_TARGET',
        max_score_target: 24,
        created_by: adminId || createdProfiles[0].id,
        status: sessionStatus,
        started_at: sessionDate.toISOString(),
        completed_at: isLastSession ? null : sessionDate.toISOString(),
        created_at: sessionDate.toISOString(),
      })
      .select()
      .single();

    assertNoError(sessErr, `Session #${sIdx} insert failed`);

    // Attendees + their seed_elo snapshot (state BEFORE this session's matches).
    const sessionAttendees = [...createdProfiles].sort(() => Math.random() - 0.5).slice(0, ATTENDEE_COUNT);
    const seedEloByProfile = new Map(sessionAttendees.map((p) => [p.id, playerStats.get(p.id).elo]));

    if (isLastSession) {
      // Leave this one genuinely open: attendees registered, zero rounds/matches, so the
      // Live Board's "Generate Round 1" has real session_players to work with.
      const sPlayerInserts = sessionAttendees.map((p) => ({
        session_id: sessionData.id,
        community_id: newComm.id,
        profile_id: p.id,
        seed_elo: seedEloByProfile.get(p.id),
      }));
      const { error: spErr } = await supabase.from('session_players').insert(sPlayerInserts);
      assertNoError(spErr, `Session #${sIdx} (ACTIVE) session_players insert failed`);
      console.log(`🟢 Session #${sIdx} left ACTIVE with ${sPlayerInserts.length} attendees, 0 rounds — ready for live testing.`);
      continue;
    }

    // Build every round row up front so matches can reference a real round_id.
    const totalRounds = Math.ceil(MATCHES_PER_SESSION / COURT_COUNT);
    const roundInserts = [];
    for (let rNum = 1; rNum <= totalRounds; rNum++) {
      roundInserts.push({
        session_id: sessionData.id,
        community_id: newComm.id,
        round_number: rNum,
        status: 'COMPLETED',
        generated_at: sessionDate.toISOString(),
        completed_at: sessionDate.toISOString(),
      });
    }
    const { data: insertedRounds, error: roundErr } = await supabase
      .from('rounds')
      .insert(roundInserts)
      .select('id, round_number');
    assertNoError(roundErr, `Session #${sIdx} rounds insert failed`);
    const roundIdByNumber = new Map(insertedRounds.map((r) => [r.round_number, r.id]));

    // Per-session aggregate (matches_played/points/W-L-D), separate from the global
    // playerStats Elo carry-over, so session_players reflects only this session.
    const sessionAgg = new Map(
      sessionAttendees.map((p) => [p.id, { matchesPlayed: 0, pointsFor: 0, pointsAgainst: 0, wins: 0, losses: 0, draws: 0 }])
    );

    const matchInserts = [];
    const matchMeta = [];

    for (let mIdx = 1; mIdx <= MATCHES_PER_SESSION; mIdx++) {
      const roundNumber = Math.ceil(mIdx / COURT_COUNT);
      const courtNumber = ((mIdx - 1) % COURT_COUNT) + 1;
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

      const { deltaA, deltaB } = calculateMatchElo(teamA, teamB, scoreA, scoreB, ATTENDEE_COUNT, COURT_COUNT);
      const individualDeltaA = deltaA / 2;
      const individualDeltaB = deltaB / 2;

      const eloBefore = { a1: p1.elo, a2: p2.elo, b1: p3.elo, b2: p4.elo };

      teamA.forEach((p) => {
        p.elo = Math.max(100.0, Number((p.elo + individualDeltaA).toFixed(2)));
        p.peakElo = Math.max(p.peakElo, p.elo);
        p.matches += 1;
        p.pointsFor += scoreA;
        p.pointsAgainst += scoreB;
        if (scoreA > scoreB) p.wins += 1; else p.losses += 1;

        const agg = sessionAgg.get(p.id);
        agg.matchesPlayed += 1;
        agg.pointsFor += scoreA;
        agg.pointsAgainst += scoreB;
        if (scoreA > scoreB) agg.wins += 1; else agg.losses += 1;
      });

      teamB.forEach((p) => {
        p.elo = Math.max(100.0, Number((p.elo + individualDeltaB).toFixed(2)));
        p.peakElo = Math.max(p.peakElo, p.elo);
        p.matches += 1;
        p.pointsFor += scoreB;
        p.pointsAgainst += scoreA;
        if (scoreB > scoreA) p.wins += 1; else p.losses += 1;

        const agg = sessionAgg.get(p.id);
        agg.matchesPlayed += 1;
        agg.pointsFor += scoreB;
        agg.pointsAgainst += scoreA;
        if (scoreB > scoreA) agg.wins += 1; else agg.losses += 1;
      });

      totalMatchesSimulated += 1;

      matchInserts.push({
        session_id: sessionData.id,
        round_id: roundIdByNumber.get(roundNumber),
        community_id: newComm.id,
        round_number: roundNumber,
        court_number: courtNumber,
        team_a_score: scoreA,
        team_b_score: scoreB,
        winner_side: scoreA > scoreB ? 'A' : 'B',
        is_draw: false,
        status: 'COMPLETED',
        elo_applied: true,
        completed_at: new Date(sessionDate.getTime() + mIdx * 600000).toISOString(),
        created_at: new Date(sessionDate.getTime() + mIdx * 600000).toISOString(),
      });

      matchMeta.push({
        round: roundNumber,
        court: courtNumber,
        players: [
          { profile_id: p1.id, team: 'A', slot: 1, elo_before: eloBefore.a1, elo_delta: individualDeltaA, elo_after: p1.elo },
          { profile_id: p2.id, team: 'A', slot: 2, elo_before: eloBefore.a2, elo_delta: individualDeltaA, elo_after: p2.elo },
          { profile_id: p3.id, team: 'B', slot: 1, elo_before: eloBefore.b1, elo_delta: individualDeltaB, elo_after: p3.elo },
          { profile_id: p4.id, team: 'B', slot: 2, elo_before: eloBefore.b2, elo_delta: individualDeltaB, elo_after: p4.elo },
        ],
      });
    }

    const { data: insertedMatches, error: matchErr } = await supabase
      .from('matches')
      .insert(matchInserts)
      .select('id, round_number, court_number');
    assertNoError(matchErr, `Session #${sIdx} matches insert failed`);

    const matchIdByKey = new Map(insertedMatches.map((m) => [`${m.round_number}:${m.court_number}`, m.id]));

    const matchPlayerInserts = [];
    matchMeta.forEach((meta) => {
      const matchId = matchIdByKey.get(`${meta.round}:${meta.court}`);
      meta.players.forEach((pl) => {
        matchPlayerInserts.push({
          match_id: matchId,
          session_id: sessionData.id,
          community_id: newComm.id,
          profile_id: pl.profile_id,
          team: pl.team,
          slot: pl.slot,
          elo_before: pl.elo_before,
          elo_delta: pl.elo_delta,
          elo_after: pl.elo_after,
        });
      });
    });

    const { error: mpErr } = await supabase.from('match_players').insert(matchPlayerInserts);
    assertNoError(mpErr, `Session #${sIdx} match_players insert failed`);

    const sPlayerInserts = sessionAttendees.map((p) => {
      const agg = sessionAgg.get(p.id);
      return {
        session_id: sessionData.id,
        community_id: newComm.id,
        profile_id: p.id,
        seed_elo: seedEloByProfile.get(p.id),
        matches_played: agg.matchesPlayed,
        session_points_for: agg.pointsFor,
        session_points_against: agg.pointsAgainst,
        session_wins: agg.wins,
        session_losses: agg.losses,
        session_draws: agg.draws,
      };
    });
    const { error: spErr } = await supabase.from('session_players').insert(sPlayerInserts);
    assertNoError(spErr, `Session #${sIdx} session_players insert failed`);

    console.log(`✅ Session #${sIdx} (${formatName}, ${sessionStatus}): ${totalRounds} rounds, ${matchInserts.length} matches, ${sPlayerInserts.length} attendees.`);
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

  const { error: rankErr } = await supabase.from('player_rankings').insert(rankingInserts);
  assertNoError(rankErr, 'Failed to insert player_rankings');

  console.log(`🎉 SIMULATION COMPLETE! 100 players, ${NUM_SESSIONS - 1} completed sessions (${totalMatchesSimulated} real matches with rounds/match_players), 1 ACTIVE session ready for live testing.`);
}

runFullTournamentSimulation().catch((err) => {
  console.error('❌ Simulation failed:', err);
  process.exit(1);
});
