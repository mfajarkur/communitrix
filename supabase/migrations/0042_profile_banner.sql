-- Players get a second, distinct image: banner_url (a wide photo), separate from the existing
-- circular profile picture (avatar_url). Shown on the player's own profile page header and used
-- as the Wall of Fame's backdrop photo. Self-only to edit — profiles_update_self RLS (0006)
-- already allows a user to update any column on their own row, no new policy needed.

alter table public.profiles
  add column banner_url text;
