-- Migration 0017: Function to resolve user email from username or email identifier for password login

create or replace function public.get_email_by_username(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_clean_identifier text;
begin
  if p_identifier is null or trim(p_identifier) = '' then
    return null;
  end if;

  v_clean_identifier := lower(trim(p_identifier));

  -- If it's already an email format, return it directly
  if v_clean_identifier like '%@%' then
    select email into v_email
    from auth.users
    where lower(email) = v_clean_identifier
    limit 1;
    return coalesce(v_email, v_clean_identifier);
  end if;

  -- Otherwise, look up profile by username
  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.auth_user_id
  where lower(p.username) = v_clean_identifier
  limit 1;

  return v_email;
end;
$$;

grant execute on function public.get_email_by_username(text) to anon, authenticated;
