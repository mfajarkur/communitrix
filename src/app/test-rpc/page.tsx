import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function TestRpcPage() {
  let resultStr = '';
  try {
    const supabaseUserClient = await createServerClient();
    
    // 1. Check if user is logged in
    const { data: { user }, error: userErr } = await supabaseUserClient.auth.getUser();
    
    if (userErr || !user) {
      resultStr += `ERROR: You are not logged in! Please login to your account first at https://communitrix.vercel.app/login, then reload this page.\n`;
    } else {
      resultStr += `Logged in as: ${user.email} (ID: ${user.id})\n`;

      // 2. Use service role client to bypass RLS for diagnostics
      const serviceRoleClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Fetch community "racqhand" (bypassing RLS)
      const { data: community, error: cErr } = await serviceRoleClient
        .from('communities')
        .select('id, name')
        .eq('slug', 'racqhand')
        .single();

      if (cErr) {
        resultStr += `Community fetch error (bypassing RLS): ${cErr.message}\n`;
      } else {
        resultStr += `Community ID: ${community.id} (${community.name})\n`;

        // Fetch active members (bypassing RLS)
        const { data: members, error: mErr } = await serviceRoleClient
          .from('community_members')
          .select('profile_id, role, profile:profiles(full_name)')
          .eq('community_id', community.id)
          .eq('is_active', true);

        if (mErr) {
          resultStr += `Members fetch error: ${mErr.message}\n`;
        } else {
          const attendeeIds = members.map(m => m.profile_id);
          resultStr += `Found ${members.length} members: ${members.map((m: any) => m.profile?.full_name).join(', ')}\n`;

          // Check if current user is community member
          const profileId = members.find((m: any) => m.profile_id === m.profile_id)?.profile_id;
          resultStr += `Attempting RPC start_session with user client...\n`;

          // Call RPC under user's actual authenticated client
          const { data: sessionId, error: startErr } = await supabaseUserClient.rpc('start_session', {
            p_community_id: community.id,
            p_name: 'Match Session - Diagnostic',
            p_format: 'AMERICANO',
            p_sport: 'PADEL',
            p_scoring_type: 'POINTS',
            p_points_mode: 'FIRST_TO_TARGET',
            p_max_score_target: 21,
            p_rounds_planned: 8,
            p_court_count: 2,
            p_attendee_ids: attendeeIds,
          });

          if (startErr) {
            resultStr += `RPC start_session FAILED: ${JSON.stringify(startErr, null, 2)}\n`;
          } else {
            resultStr += `RPC start_session SUCCESS! Session ID: ${sessionId}\n`;
          }
        }
      }
    }
  } catch (err: any) {
    resultStr += `Server error: ${err.message}\n`;
  }

  return (
    <div className="p-8 font-mono bg-zinc-950 text-emerald-400 min-h-screen">
      <h1 className="text-xl font-bold text-white mb-4">RPC start_session Diagnostic Console</h1>
      <pre className="whitespace-pre-wrap p-4 bg-zinc-900 border border-zinc-800 rounded-lg">{resultStr}</pre>
    </div>
  );
}
