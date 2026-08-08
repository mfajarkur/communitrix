-- Drop the view that depends on `is_provisional`
drop view if exists public.v_leaderboard;

-- Update the `is_provisional` generated column to use a threshold of 5 matches instead of 10
alter table public.player_rankings
  drop column is_provisional;

alter table public.player_rankings
  add column is_provisional boolean not null generated always as (total_matches < 5) stored;

-- Recreate the view
create or replace view public.v_leaderboard
with (security_invoker = true) as
select r.community_id, r.sport, r.profile_id, p.full_name, p.avatar_url,
       r.elo_rating, r.total_matches, r.total_wins, r.total_losses,
       case when r.total_matches = 0 then null
            else round(100.0 * r.total_wins / r.total_matches, 1) end as win_rate,
       r.is_provisional,
       rank() over (partition by r.community_id, r.sport order by r.elo_rating desc) as rank
from public.player_rankings r join public.profiles p on p.id = r.profile_id;
