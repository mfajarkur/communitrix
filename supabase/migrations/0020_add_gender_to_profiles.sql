-- Add gender column to profiles table
alter table public.profiles add column if not exists gender text check (gender in ('MALE', 'FEMALE'));
