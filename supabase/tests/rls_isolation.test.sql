-- pgTAP test file for Row Level Security (RLS) tenant isolation
-- Run with: supabase db test

begin;
select plan(16); -- Number of assertions we will run

-- 1. Setup mock data for RLS testing
-- We temporarily switch to the postgres superuser role to set up our test data.
set local role postgres;

-- Create mock authenticated users in auth.users
insert into auth.users (id, email) values 
  ('a0000000-0000-0000-0000-000000000001', 'user_a@test.com'),
  ('a0000000-0000-0000-0000-000000000002', 'user_b@test.com'),
  ('a0000000-0000-0000-0000-000000000003', 'admin_a@test.com'),
  ('a0000000-0000-0000-0000-000000000004', 'platform_admin@test.com');

-- Create matching profiles
insert into profiles (id, auth_user_id, full_name) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'User A'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'User B'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Admin A'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Platform Admin');

-- Platform admin association
insert into platform_admins (profile_id) values ('b0000000-0000-0000-0000-000000000004');

-- Create Guest Profile in Community A (created by Admin A)
insert into profiles (id, auth_user_id, full_name, created_by) values
  ('b0000000-0000-0000-0000-000000000005', null, 'Guest G', 'b0000000-0000-0000-0000-000000000003');

-- Create Communities (we bypass FK to profiles by setting created_by temporarily to Admin A)
insert into communities (id, name, slug, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'Community A', 'comm-a', 'b0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000002', 'Community B', 'comm-b', 'b0000000-0000-0000-0000-000000000002');

-- Associate memberships
insert into community_members (community_id, profile_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'ADMIN'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'MEMBER'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'MEMBER'), -- Guest G is a member here
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'MEMBER');

-- Sessions
insert into sessions (id, community_id, session_name, sport, match_type, format, scoring_type, max_score_target, created_by) values
  ('s0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Session A', 'PADEL', 'DOUBLES', 'AMERICANO', 'POINTS', 24, 'b0000000-0000-0000-0000-000000000003'),
  ('s0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'Session B', 'PADEL', 'DOUBLES', 'AMERICANO', 'POINTS', 24, 'b0000000-0000-0000-0000-000000000002');

-- Rounds
insert into rounds (id, session_id, community_id, round_number) values
  ('r0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1);

-- Matches
insert into matches (id, session_id, round_id, community_id, round_number, court_number) values
  ('m0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 1);

-- Rankings
insert into player_rankings (id, community_id, profile_id, sport, elo_rating) values
  ('k0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'PADEL', 1000.00),
  ('k0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'PADEL', 1000.00);


-- ─────────────── Test Execution ───────────────

-- Set context to User A (authenticated, community A member)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000001"}';

-- Test 1: User in community A cannot select a session, match, or ranking of community B.
select is(
  (select count(*)::int from sessions where community_id = 'c0000000-0000-0000-0000-000000000002'),
  0,
  'User A in community A cannot select a session of community B'
);

select is(
  (select count(*)::int from matches where community_id = 'c0000000-0000-0000-0000-000000000002'),
  0,
  'User A in community A cannot select a match of community B'
);

select is(
  (select count(*)::int from player_rankings where community_id = 'c0000000-0000-0000-0000-000000000002'),
  0,
  'User A in community A cannot select a player ranking of community B'
);

-- Test 2: MEMBER cannot insert a session.
select throws_ok(
  $$insert into sessions (community_id, session_name, sport, match_type, format, scoring_type, max_score_target, created_by) values
    ('c0000000-0000-0000-0000-000000000001', 'Session Test 2', 'PADEL', 'DOUBLES', 'AMERICANO', 'POINTS', 24, 'b0000000-0000-0000-0000-000000000001')$$,
  '42501',
  'MEMBER role cannot insert a session'
);

-- Test 3: Any client update player_rankings set elo_rating = 9999 fails.
select throws_ok(
  $$update player_rankings set elo_rating = 9999.00 where id = 'k0000000-0000-0000-0000-000000000001'$$,
  '42501',
  'Any client update player_rankings fails'
);

-- Test 4: Any client insert into matches fails.
select throws_ok(
  $$insert into matches (session_id, round_id, community_id, round_number, court_number) values
    ('s0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 2)$$,
  '42501',
  'Any client insert into matches fails'
);

-- Test 5: select on community_members does not raise infinite recursion.
select lives_ok(
  $$select * from community_members$$,
  'select on community_members does not raise infinite recursion'
);

-- Test 6: Anonymous role has zero rows on every table.
set local role anon;
set local request.jwt.claims = '{}';

select is((select count(*)::int from communities), 0, 'anon sees 0 communities');
select is((select count(*)::int from profiles), 0, 'anon sees 0 profiles');
select is((select count(*)::int from community_members), 0, 'anon sees 0 community_members');
select is((select count(*)::int from player_rankings), 0, 'anon sees 0 player_rankings');
select is((select count(*)::int from sessions), 0, 'anon sees 0 sessions');
select is((select count(*)::int from session_players), 0, 'anon sees 0 session_players');
select is((select count(*)::int from rounds), 0, 'anon sees 0 rounds');
select is((select count(*)::int from matches), 0, 'anon sees 0 matches');

-- Test 7: A guest profile is visible to co-members of its community and invisible to everyone else.
-- Switch back to User A (shares community with Guest G)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000001"}';

select is(
  (select count(*)::int from profiles where id = 'b0000000-0000-0000-0000-000000000005'),
  1,
  'Guest G is visible to User A (co-member of community A)'
);

-- Switch to User B (does not share community with Guest G)
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000002"}';

select is(
  (select count(*)::int from profiles where id = 'b0000000-0000-0000-0000-000000000005'),
  0,
  'Guest G is invisible to User B (not in community A)'
);

rollback;
