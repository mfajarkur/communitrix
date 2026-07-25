import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function TestRpcPage() {
  let resultStr = '';
  try {
    const supabase = await createClient();

    // Fetch community "racqhand"
    const { data: community, error: cErr } = await supabase
      .from('communities')
      .select('id')
      .eq('slug', 'racqhand')
      .single();

    if (cErr) {
      resultStr += `Community fetch error: ${cErr.message}\n`;
    } else {
      resultStr += `Community ID: ${community.id}\n`;

      // Fetch active members
      const { data: members, error: mErr } = await supabase
        .from('community_members')
        .select('profile_id, profile:profiles(full_name)')
        .eq('community_id', community.id)
        .eq('is_active', true);

      if (mErr) {
        resultStr += `Members fetch error: ${mErr.message}\n`;
      } else {
        const attendeeIds = members.map(m => m.profile_id);
        resultStr += `Found ${members.length} members: ${members.map((m: any) => m.profile?.full_name).join(', ')}\n`;

        // Attempt RPC call
        resultStr += `Calling start_session RPC...\n`;
        const { data: sessionId, error: startErr } = await supabase.rpc('start_session', {
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
