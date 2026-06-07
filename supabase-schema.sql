-- PYQ-LY · Supabase schema for the library features.
-- Run once in the Supabase SQL editor (Dashboard → SQL).
--
-- Already created earlier (NOT repeated here): the is_admin() function and the
-- tables `subjects`, `subject_content`, `entitlements` (curated/paid library).
--
-- The two tables below power "My Library" (personal saved analyses) and the
-- community contribution + pooling flow. They reuse the existing is_admin().

-- 1) MY LIBRARY — each signed-in user's own saved analyses, private to them.
create table if not exists public.my_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  code text,
  paper_count int default 0,
  question_count int default 0,
  topic_count int default 0,
  content jsonb not null,                 -- the analysis result { groups, ... }
  created_at timestamptz default now()
);
alter table public.my_subjects enable row level security;
create policy "my_subjects are private to their owner"
  on public.my_subjects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2) CONTRIBUTIONS — any signed-in user submits an analysis; only the admin
--    reviews. target_subject_id set => "pool" into that subject; null => new.
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text,
  title text not null,
  code text,
  target_subject_id text references public.subjects(id) on delete set null,
  content jsonb not null,
  status text not null default 'pending', -- pending | approved | rejected
  created_at timestamptz default now()
);
alter table public.contributions enable row level security;
create policy "anyone signed-in can submit a contribution"
  on public.contributions for insert
  with check (user_id = auth.uid());
create policy "submitters see their own; admin sees all"
  on public.contributions for select
  using (user_id = auth.uid() or is_admin());
create policy "only admin can update contributions"
  on public.contributions for update using (is_admin());
create policy "only admin can delete contributions"
  on public.contributions for delete using (is_admin());
