-- Optimistic concurrency for personal_quick_matches: prevents two tabs/devices resuming the
-- same OPEN match from silently overwriting each other's progress (last-write-wins bug found
-- in the profile-features audit). Callers must pass the version they last read; an UPDATE
-- that doesn't match the current version affects zero rows, which the app treats as a
-- conflict and stops syncing from the losing side instead of clobbering the winner.
alter table personal_quick_matches
  add column version int not null default 1;
