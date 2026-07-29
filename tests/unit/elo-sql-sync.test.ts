import { describe, test, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { calculateElo } from '../../src/lib/elo/calculate';
import fs from 'fs';
import path from 'path';

// Load local environment variables manually to avoid extra dependencies like 'dotenv'
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  } catch (err) {
    // Ignore
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only run the database sync test if the keys are configured
const describeOrSkip = supabaseUrl && serviceRoleKey ? describe : describe.skip;

describeOrSkip('TypeScript and PL/pgSQL ELO Logic Synchronization Tests', () => {
  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  test('TS engine and SQL RPC calculate identical Elo shifts for Padel Doubles', async () => {
    // 1. Create a temporary community
    const tempSlug = `temp-sync-test-${Date.now()}`;
    const { data: community, error: cErr } = await supabase
      .from('communities')
      .insert({
        name: 'Temp Sync Test Club',
        slug: tempSlug,
      })
      .select('id')
      .single();

    expect(cErr).toBeNull();
    expect(community).toBeDefined();
    const communityId = community!.id;

    // 2. Create 4 temporary profiles
    const profileNames = ['Player One', 'Player Two', 'Player Three', 'Player Four'];
    const profiles: any[] = [];
    for (const name of profileNames) {
      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .insert({
          full_name: name,
        })
        .select('id, full_name')
        .single();
      
      expect(pErr).toBeNull();
      profiles.push(p);
    }

    // Add them as members to the community
    for (const p of profiles) {
      const { error: mErr } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          profile_id: p.id,
          role: 'ADMIN',
          is_active: true,
        });
      expect(mErr).toBeNull();
    }

    try {
      // 3. Start a session
      // For this test, we mock the start_session RPC call using service_role
      // Wait, we need to mock current_profile_id() which checks auth.uid().
      // Since we are using the service_role key, current_profile_id() might fail or return null.
      // Wait! To allow service_role to call the RPCs that use current_profile_id(),
      // let's check: does start_session call current_profile_id()?
      // Yes!
      // To bypass this or set the auth context in our admin client:
      // We can use a trick! In postgrest-js, we can set the headers to mock the claims:
      const adminClientWithAuth = createClient(supabaseUrl!, serviceRoleKey!, {
        global: {
          headers: {
            // Mock auth.uid() by sending a JWT token or we can just temporarily link one profile to an auth user
            // or wait! We already have the profile ID.
            // Wait, does current_profile_id() check auth.uid()?
            // If auth.uid() is null, it raises UNAUTHENTICATED.
            // Let's create an auth user for this test, or we can just call the functions directly.
            // Wait, can we create an auth user in the test?
            // Yes! We can create an auth user using supabase.auth.admin.createUser().
          }
        }
      });
      
      // Let's create a temporary auth user
      const tempEmail = `temp-${Date.now()}@communitrix.com`;
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: tempEmail,
        password: 'temporaryPassword123!',
        email_confirm: true,
      });
      expect(authErr).toBeNull();
      const authUserId = authData.user!.id;

      // Link the first profile to this auth user
      const { error: linkErr } = await supabase
        .from('profiles')
        .update({ auth_user_id: authUserId })
        .eq('id', profiles[0].id);
      expect(linkErr).toBeNull();

      // Now create an authenticated client using this user's context
      const { data: linkData, error: otpLinkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: tempEmail,
      });
      expect(otpLinkErr).toBeNull();

      const userClient = createClient(supabaseUrl!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data: verifyAuthData, error: verifyErr } = await userClient.auth.verifyOtp({
        email: tempEmail,
        token: linkData?.properties?.email_otp || '',
        type: 'magiclink',
      });
      expect(verifyErr).toBeNull();

      // 4. Call start_session via the user client
      const attendeeIds = profiles.map(p => p.id);
      const { data: sessionId, error: startErr } = await userClient.rpc('start_session', {
        p_community_id: communityId,
        p_name: 'Test Sync Session',
        p_format: 'AMERICANO',
        p_sport: 'PADEL',
        p_scoring_type: 'POINTS',
        p_points_mode: 'FIRST_TO_TARGET',
        p_max_score_target: 21,
        p_rounds_planned: 8,
        p_court_count: 1,
        p_attendee_ids: attendeeIds,
      });

      expect(startErr).toBeNull();
      expect(sessionId).toBeDefined();

      // 5. Persist a round
      const matchesJson = [
        {
          courtNumber: 1,
          teamA: [profiles[0].id, profiles[1].id],
          teamB: [profiles[2].id, profiles[3].id],
        },
      ];

      const { data: roundId, error: roundErr } = await userClient.rpc('persist_round', {
        p_session_id: sessionId,
        p_round_number: 1,
        p_matches: matchesJson,
        p_sit_outs: [],
      });

      expect(roundErr).toBeNull();
      expect(roundId).toBeDefined();

      // Fetch the created match ID
      const { data: matchData, error: matchErr } = await supabase
        .from('matches')
        .select('id')
        .eq('round_id', roundId)
        .single();
      
      expect(matchErr).toBeNull();
      const matchId = matchData!.id;

      // 6. Calculate expected Elo delta in TypeScript
      const eloInput = {
        teamA: [
          { id: profiles[0].id, ratingBefore: 1000, totalMatchesPlayed: 0 },
          { id: profiles[1].id, ratingBefore: 1000, totalMatchesPlayed: 0 },
        ],
        teamB: [
          { id: profiles[2].id, ratingBefore: 1000, totalMatchesPlayed: 0 },
          { id: profiles[3].id, ratingBefore: 1000, totalMatchesPlayed: 0 },
        ],
        scoreA: 21,
        scoreB: 11,
        scoringType: 'POINTS' as const,
        pointsMode: 'FIRST_TO_TARGET' as const,
        maxScoreTarget: 21,
        roundsPlanned: 8,
        courtCount: 1,
        playersPerMatch: 4 as const,
        attendeeCount: 4, // N = 4, slots = 4 -> expected matches = 8
      };

      const tsResult = calculateElo(eloInput);
      const expectedDeltaA = tsResult.teamADeltas[0].delta; // e.g. raw delta for Team A

      // 7. Submit score in Supabase via the SQL RPC
      const { error: submitErr } = await userClient.rpc('submit_match_score', {
        p_match_id: matchId,
        p_score_a: 21,
        p_score_b: 11,
      });

      expect(submitErr).toBeNull();

      // 8. Fetch SQL Elo deltas from database
      const { data: matchPlayers, error: mpErr } = await supabase
        .from('match_players')
        .select('profile_id, elo_delta, elo_after')
        .eq('match_id', matchId);

      expect(mpErr).toBeNull();

      // Compare
      const p0Row = matchPlayers!.find(mp => mp.profile_id === profiles[0].id)!;
      const p2Row = matchPlayers!.find(mp => mp.profile_id === profiles[2].id)!;

      console.log(`TS Calculated Delta: ${expectedDeltaA}`);
      console.log(`SQL Calculated Delta: ${p0Row.elo_delta}`);

      expect(Number(p0Row.elo_delta)).toBeCloseTo(expectedDeltaA, 2);
      expect(Number(p2Row.elo_delta)).toBeCloseTo(-expectedDeltaA, 2);

      // Clean up auth user
      await supabase.auth.admin.deleteUser(authUserId);
    } finally {
      // Clean up the temporary community (cascades matches, rounds, session_players, sessions)
      await supabase.from('communities').delete().eq('id', communityId);
      
      // Clean up temporary profiles
      for (const p of profiles) {
        await supabase.from('profiles').delete().eq('id', p.id);
      }
    }
  }, 30000);
});
