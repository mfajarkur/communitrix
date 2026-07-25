-- RPC Function to Finalize a Session

create or replace function public.finalize_session(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_community_id uuid;
  v_status session_status;
  v_unfinished_matches_count int;
begin
  -- 1. Get current authenticated user profile
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED' using message = 'Authentication required', errcode = '42501';
  end if;

  -- 2. Fetch session and lock row
  select community_id, status
  into v_community_id, v_status
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using message = 'Session not found', errcode = 'P0002';
  end if;

  -- 3. Idempotency Check
  if v_status = 'COMPLETED' then
    return;
  end if;

  -- 4. Check for active matches that are not completed or voided (PRD E15)
  select count(*) into v_unfinished_matches_count
  from public.matches
  where session_id = p_session_id
    and status not in ('COMPLETED', 'VOIDED');

  if v_unfinished_matches_count > 0 then
    raise exception 'UNFINISHED_MATCHES' using message = 'Cannot finalize session with unfinished matches. Score or void all courts first.', errcode = '45000';
  end if;

  -- 5. Update session status
  update public.sessions
  set status = 'COMPLETED',
      completed_at = now()
  where id = p_session_id;

end;
$$;
