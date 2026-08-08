const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // use service role or anon
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: communities } = await supabase.from('communities').select('id, slug');
  if (!communities || communities.length === 0) return console.log('no comms found');

  for (const community of communities) {
    console.log('--- Comm:', community.slug);

    const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
          *,
          session_players (
            id,
            profile_id,
            status,
            session_wins,
            session_losses,
            session_draws,
            session_points_for,
            session_points_against
          )
        `)
        .eq('community_id', community.id)
        .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      continue;
    }
    console.log('Sessions count:', sessions?.length);

    const medalsMap = {};
    (sessions || []).forEach((session) => {
      if (session.status !== 'ENDED') return;
      const players = (session.session_players || []).filter(
        (sp) => sp.status === 'ACTIVE' || sp.status === 'WITHDRAWN'
      );
      if (players.length === 0) return;

      const N = session.max_score_target || 7;
      const halfN = Math.round(N / 2);
      const byeMethod = session.bye_scoring_method || 'HALF_N';
      const maxRealMatchesPlayed = players.reduce(
        (max, p) => Math.max(max, (p.session_wins || 0) + (p.session_losses || 0) + (p.session_draws || 0)),
        0
      );

      const computed = players
        .map((p) => {
          const wins = p.session_wins || 0;
          const losses = p.session_losses || 0;
          const ties = p.session_draws || 0;
          const realMatchesPlayed = wins + losses + ties;
          const matchesBehind = maxRealMatchesPlayed - realMatchesPlayed;

          const rawByeScore =
            byeMethod === 'HALF_N' || realMatchesPlayed === 0
              ? halfN
              : Math.round((p.session_points_for || 0) / realMatchesPlayed);
          const byeScore = Math.max(0, Math.min(N, rawByeScore));
          const byePoints = matchesBehind > 0 ? matchesBehind * byeScore : 0;

          const totalPoints = (p.session_points_for || 0) + byePoints;
          const diff = totalPoints - (p.session_points_against || 0);

          return {
            profile_id: p.profile_id,
            wins,
            diff,
            totalPoints,
          };
        })
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.diff !== a.diff) return b.diff - a.diff;
          return b.totalPoints - a.totalPoints;
        });

      console.log(`Session ${session.id} podium:`, computed.slice(0, 3));

      if (computed[0]?.profile_id) {
        const pId = computed[0].profile_id;
        if (!medalsMap[pId]) medalsMap[pId] = { gold: 0, silver: 0, bronze: 0 };
        medalsMap[pId].gold += 1;
      }
      if (computed[1]?.profile_id) {
        const pId = computed[1].profile_id;
        if (!medalsMap[pId]) medalsMap[pId] = { gold: 0, silver: 0, bronze: 0 };
        medalsMap[pId].silver += 1;
      }
      if (computed[2]?.profile_id) {
        const pId = computed[2].profile_id;
        if (!medalsMap[pId]) medalsMap[pId] = { gold: 0, silver: 0, bronze: 0 };
        medalsMap[pId].bronze += 1;
      }
    });
    console.log('Medals Map:', medalsMap);
  }
}
test();
