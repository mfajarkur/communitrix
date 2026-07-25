-- SQL Migration: Session Idle Auto-Pause Cron RPC

create or replace function public.pause_idle_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count int;
begin
  -- Update sessions to 'PAUSED' if they have been inactive for more than 12 hours
  update public.sessions
  set status = 'PAUSED'
  where status = 'ACTIVE'
    and (
      -- Case A: no matches have been completed yet and the session was created > 12h ago
      (
        not exists (
          select 1 from public.matches
          where session_id = sessions.id and status = 'COMPLETED'
        )
        and created_at < now() - interval '12 hours'
      )
      or
      -- Case B: matches have been completed, but the last completed match was > 12h ago
      (
        exists (
          select 1 from public.matches
          where session_id = sessions.id and status = 'COMPLETED'
        )
        and (
          select max(completed_at)
          from public.matches
          where session_id = sessions.id and status = 'COMPLETED'
        ) < now() - interval '12 hours'
      )
    );

  get diagnostics v_updated_count = row_count;
  raise notice 'Auto-paused % idle active sessions.', v_updated_count;
end;
$$;
