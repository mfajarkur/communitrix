import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Authorization Guard (Vercel Cron security pattern)
    const authHeader = request.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      process.env.NODE_ENV === 'production'
    ) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Instantiate administrative database client (service role bypass)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    // 3. Execute cron auto-pause database function
    const { error } = await supabase.rpc('pause_idle_sessions');

    if (error) {
      console.error('Cron pause_idle_sessions execution failed:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Cron job run completed successfully.' });
  } catch (err: any) {
    console.error('Cron job exception:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Server exception encountered' },
      { status: 500 }
    );
  }
}
