-- PYQ-LY · Canonical schema + RLS for the CURATED library core tables.
--
-- These three tables + the is_admin() function were created in an early session
-- and never committed; this file is the source-of-truth DDL so the schema (and
-- especially the PAYWALL row-level-security) is version-controlled and verifiable.
--
-- SAFE TO RUN: every statement is idempotent — `create table if not exists`
-- never alters or drops an existing table (your data is untouched), and each
-- policy is dropped-if-exists before being (re)created. Run it in the Supabase
-- SQL editor to bring an existing project in line with this file, then run the
-- VERIFY query at the bottom to confirm the paywall is the ONLY read policy.
--
-- REQUIRES the is_admin() function (already created earlier). It should return
-- true when the caller's email is the admin email, e.g.:
--   create or replace function public.is_admin() returns boolean language sql stable as $$
--     select lower(coalesce(auth.jwt() ->> 'email','')) = lower('<ADMIN_EMAIL>');
--   $$;
-- (Left commented so this file never overwrites your working definition.)

-- 1) SUBJECTS — public metadata; anyone can browse, only the admin writes.
create table if not exists public.subjects (
  id text primary key,                        -- slug used in the link
  subject text not null,                      -- display name
  code text,
  paper_count int default 0,
  question_count int default 0,
  topic_count int default 0,
  is_free boolean not null default true,      -- free => content readable by anyone
  created_at timestamptz default now()
);
alter table public.subjects enable row level security;
drop policy if exists "subjects are publicly readable" on public.subjects;
create policy "subjects are publicly readable" on public.subjects for select using (true);
drop policy if exists "only admin inserts subjects" on public.subjects;
create policy "only admin inserts subjects" on public.subjects for insert with check (is_admin());
drop policy if exists "only admin updates subjects" on public.subjects;
create policy "only admin updates subjects" on public.subjects for update using (is_admin());
drop policy if exists "only admin deletes subjects" on public.subjects;
create policy "only admin deletes subjects" on public.subjects for delete using (is_admin());

-- 2) SUBJECT_CONTENT — the actual questions/groups. THE PAYWALL lives here:
--    a row is readable only if the subject is free, OR the caller is entitled to
--    it, OR the caller is the admin. Enforced server-side; the client can never
--    bypass it. Writes are admin-only.
create table if not exists public.subject_content (
  subject_id text primary key references public.subjects(id) on delete cascade,
  content jsonb not null
);
alter table public.subject_content enable row level security;
drop policy if exists "subject_content readable if free, entitled or admin" on public.subject_content;
create policy "subject_content readable if free, entitled or admin"
  on public.subject_content for select
  using (
    is_admin()
    or exists (select 1 from public.subjects s where s.id = subject_content.subject_id and s.is_free = true)
    or exists (
      select 1 from public.entitlements e
      where e.subject_id = subject_content.subject_id
        and lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
drop policy if exists "only admin inserts subject_content" on public.subject_content;
create policy "only admin inserts subject_content" on public.subject_content for insert with check (is_admin());
drop policy if exists "only admin updates subject_content" on public.subject_content;
create policy "only admin updates subject_content" on public.subject_content for update using (is_admin());
drop policy if exists "only admin deletes subject_content" on public.subject_content;
create policy "only admin deletes subject_content" on public.subject_content for delete using (is_admin());

-- 3) ENTITLEMENTS — (email, subject) access grants. A user sees only their own
--    rows; only the admin grants/revokes.
create table if not exists public.entitlements (
  email text not null,
  subject_id text not null references public.subjects(id) on delete cascade,
  granted_at timestamptz default now(),
  primary key (email, subject_id)
);
alter table public.entitlements enable row level security;
drop policy if exists "users see their own entitlements; admin sees all" on public.entitlements;
create policy "users see their own entitlements; admin sees all"
  on public.entitlements for select
  using (is_admin() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists "only admin inserts entitlements" on public.entitlements;
create policy "only admin inserts entitlements" on public.entitlements for insert with check (is_admin());
drop policy if exists "only admin updates entitlements" on public.entitlements;
create policy "only admin updates entitlements" on public.entitlements for update using (is_admin());
drop policy if exists "only admin deletes entitlements" on public.entitlements;
create policy "only admin deletes entitlements" on public.entitlements for delete using (is_admin());

-- ───────────────────────────────────────────────────────────────────────────
-- VERIFY (run before you ever charge): list every read policy on the paywalled
-- table. There must be exactly ONE SELECT policy — the free/entitled/admin one
-- above. If an older, more permissive read policy is also listed (e.g. one whose
-- `qual` is just `true`), DROP it — with permissive policies, OR-semantics mean
-- one open policy defeats the paywall.
--   select policyname, cmd, qual
--   from pg_policies
--   where schemaname = 'public' and tablename = 'subject_content';
