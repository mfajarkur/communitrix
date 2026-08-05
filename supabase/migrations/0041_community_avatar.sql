-- Communities get a second, distinct image: avatar_url (circular profile picture), separate
-- from the existing logo_url (the wide 2.5:1 header banner/"badge", uploaded via
-- BannerImageEditor's "Edit Badge" button — unchanged, kept as the header background image).
-- Both remain admin-only to edit, same as logo_url's existing uploadCommunityLogoAction check.

alter table public.communities
  add column avatar_url text;
