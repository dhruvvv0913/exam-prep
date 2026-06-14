-- PYQ-LY · Usage log — powers (a) a per-user daily cap on the LLM grouping
-- proxy (cost/abuse control) and (b) simple admin analytics (AI calls, popular
-- subjects). Run once in the Supabase SQL editor. Reuses the existing is_admin().
--
-- Everything that writes here is best-effort: if this table doesn't exist, the
-- proxy fails OPEN (no limit) and client logging silently no-ops.

create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  email text,
  kind text not null,                 -- 'group' (an AI grouping call) | 'open' (subject opened)
  subject_id text,                    -- set for 'open'
  created_at timestamptz default now()
);
create index if not exists api_usage_user_created_idx on public.api_usage (user_id, created_at);

alter table public.api_usage enable row level security;
drop policy if exists "usage: insert own" on public.api_usage;
create policy "usage: insert own"
  on public.api_usage for insert with check (user_id = auth.uid());
drop policy if exists "usage: read own or admin" on public.api_usage;
create policy "usage: read own or admin"
  on public.api_usage for select using (user_id = auth.uid() or is_admin());
