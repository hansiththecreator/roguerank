create table if not exists public.poll_comments (
  id uuid primary key default gen_random_uuid(),
  poll_id text not null,
  username text not null,
  text text not null,
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.poll_comments(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists comment_likes_comment_user_idx
  on public.comment_likes (comment_id, user_id);

create table if not exists public.saved_polls (
  id uuid primary key default gen_random_uuid(),
  poll_id text not null,
  user_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists saved_polls_poll_user_idx
  on public.saved_polls (poll_id, user_id);

create table if not exists public.poll_reports (
  id uuid primary key default gen_random_uuid(),
  poll_id text not null,
  user_id text,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id text not null,
  option_id text,
  username text,
  user_id text,
  created_at timestamptz not null default now()
);

alter table public.poll_options
  add column if not exists specs jsonb,
  add column if not exists win_rate double precision;

create index if not exists poll_comments_poll_created_at_idx
  on public.poll_comments (poll_id, created_at desc);

create index if not exists poll_reports_poll_created_at_idx
  on public.poll_reports (poll_id, created_at desc);

create index if not exists poll_votes_poll_created_at_idx
  on public.poll_votes (poll_id, created_at desc);

alter table public.poll_comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.saved_polls enable row level security;
alter table public.poll_reports enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "Public read poll comments" on public.poll_comments;
create policy "Public read poll comments"
  on public.poll_comments for select
  using (true);

drop policy if exists "Public create poll comments" on public.poll_comments;
create policy "Public create poll comments"
  on public.poll_comments for insert
  with check (true);

drop policy if exists "Public create comment likes" on public.comment_likes;
create policy "Public create comment likes"
  on public.comment_likes for insert
  with check (true);

drop policy if exists "Public create saved polls" on public.saved_polls;
create policy "Public create saved polls"
  on public.saved_polls for insert
  with check (true);

drop policy if exists "Public read saved polls" on public.saved_polls;
create policy "Public read saved polls"
  on public.saved_polls for select
  using (true);

drop policy if exists "Public create poll reports" on public.poll_reports;
create policy "Public create poll reports"
  on public.poll_reports for insert
  with check (true);

drop policy if exists "Public create poll votes" on public.poll_votes;
create policy "Public create poll votes"
  on public.poll_votes for insert
  with check (true);

drop policy if exists "Public read poll votes" on public.poll_votes;
create policy "Public read poll votes"
  on public.poll_votes for select
  using (true);
