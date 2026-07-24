-- Create indexes to optimize queries and RLS policy checks
create index cm_profile_id_active_idx on community_members (profile_id) where is_active;
create index cm_community_id_role_idx on community_members (community_id, role);
create index player_rankings_lookup_idx on player_rankings (community_id, sport, elo_rating desc);
create index sessions_lookup_idx on sessions (community_id, status, scheduled_for desc);
create index session_players_lookup_idx on session_players (session_id, status);
create index matches_lookup_idx on matches (session_id, round_number, court_number);
create index matches_completed_idx on matches (community_id, completed_at) where status = 'COMPLETED';
create index match_players_profile_comm_idx on match_players (profile_id, community_id);
create index match_players_session_idx on match_players (session_id);
create index profiles_auth_user_id_idx on profiles (auth_user_id);
