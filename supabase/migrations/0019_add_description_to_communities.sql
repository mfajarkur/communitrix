-- Add description column to communities table if not exists
alter table communities add column if not exists description text;
