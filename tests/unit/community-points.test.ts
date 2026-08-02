import { describe, test, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Same manual .env.local loader as elo-sql-sync.test.ts, kept local to avoid a shared-file
// coupling between two otherwise-independent test suites.
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
        if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
        else if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
        process.env[key] = val;
      }
    });
  } catch {
    // Ignore
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = supabaseUrl && serviceRoleKey ? describe : describe.skip;

// calculate_cp_points (supabase/migrations/0029_community_points.sql) is a pure SQL function —
// no auth/table access involved — so it's callable directly with the service role key, no need
// for the auth-context dance elo-sql-sync.test.ts has to do for functions that touch RLS-scoped
// tables. Values below are exactly what docs/communitrix-elo-adjustment-brief.md section 9
// specifies: podium + cliff (N>=10: 100/75/50/20) or podium-only (N<10: 75/50/25), then a linear
// decay tail from 20 down to a floor of 8 for N>=10, or a flat 10 for N<10.
describeOrSkip('calculate_cp_points (Community Points formula)', () => {
  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cp = async (rank: number, sessionSize: number) => {
    const { data, error } = await supabase.rpc('calculate_cp_points', {
      p_rank: rank,
      p_session_size: sessionSize,
    });
    expect(error).toBeNull();
    return Number(data);
  };

  test('N >= 10: podium + cliff at rank 4, decay tail from 20 to floor 8', async () => {
    expect(await cp(1, 10)).toBe(100);
    expect(await cp(2, 10)).toBe(75);
    expect(await cp(3, 10)).toBe(50);
    expect(await cp(4, 10)).toBe(20); // the cliff — -30 from rank 3, not just -25
    expect(await cp(5, 10)).toBe(20); // decay tail starts exactly at 20
    expect(await cp(10, 10)).toBe(8); // last rank in a 10-player session hits the floor exactly

    // Bigger field: decay tail is longer, so the midpoint isn't simply the average of the ends
    expect(await cp(5, 16)).toBe(20);
    expect(await cp(16, 16)).toBe(8);
    expect(await cp(10, 16)).toBeCloseTo(14.55, 1); // field_position=5, field_size=11
  });

  test('N < 10: podium only (75/50/25), flat 10 for everyone else', async () => {
    expect(await cp(1, 8)).toBe(75);
    expect(await cp(2, 8)).toBe(50);
    expect(await cp(3, 8)).toBe(25);
    expect(await cp(4, 8)).toBe(10);
    expect(await cp(8, 8)).toBe(10);

    // Minimum realistic session size (4 players, the padel floor enforced by start_session)
    expect(await cp(1, 4)).toBe(75);
    expect(await cp(4, 4)).toBe(10);
  });
});
