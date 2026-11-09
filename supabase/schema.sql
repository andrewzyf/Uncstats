-- UncStats — complete PostgreSQL schema with Realtime
-- Deadpan clinical audit tables for Instagram Reels doomscrolling telemetry.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  ig_handle text,
  device_os text not null check (device_os in ('android', 'ios')),
  unc_tier text not null default 'Gainfully Employed',
  squad_id text,
  school_id text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_ig_handle_idx on public.profiles (ig_handle);
create index if not exists profiles_squad_id_idx on public.profiles (squad_id);
create index if not exists profiles_school_id_idx on public.profiles (school_id);

-- ---------------------------------------------------------------------------
-- daily_stats
-- ---------------------------------------------------------------------------
create table if not exists public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null default (timezone('utc', now()))::date,
  reels_scrolled integer not null default 0 check (reels_scrolled >= 0),
  reels_liked integer not null default 0 check (reels_liked >= 0),
  comments_read_or_posted integer not null default 0 check (comments_read_or_posted >= 0),
  shares_dmed integer not null default 0 check (shares_dmed >= 0),
  active_scroll_seconds integer not null default 0 check (active_scroll_seconds >= 0),
  fastest_skip_ms integer not null default 0 check (fastest_skip_ms >= 0),
  longest_rot_streak_mins integer not null default 0 check (longest_rot_streak_mins >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists daily_stats_date_reels_idx
  on public.daily_stats (date desc, reels_scrolled desc);

create index if not exists daily_stats_user_date_idx
  on public.daily_stats (user_id, date desc);

-- ---------------------------------------------------------------------------
-- global_calibration
-- Single-row calibration table: Android-sourced average Reels per minute.
-- Default 10.8 Reels/min (~5.55s per Reel) for iOS estimate conversion.
-- ---------------------------------------------------------------------------
create table if not exists public.global_calibration (
  id integer primary key default 1 check (id = 1),
  reels_per_minute numeric(8, 4) not null default 10.8000,
  sample_android_users integer not null default 0,
  sample_active_minutes integer not null default 0,
  sample_reels_scrolled integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.global_calibration (id, reels_per_minute)
values (1, 10.8000)
on conflict (id) do nothing;

-- Aggregated live view: recompute from today's Android sessions when available.
create or replace view public.global_calibration_live as
with android_today as (
  select
    count(distinct p.id)::integer as sample_android_users,
    coalesce(sum(ds.active_scroll_seconds), 0)::integer as total_active_seconds,
    coalesce(sum(ds.reels_scrolled), 0)::integer as sample_reels_scrolled
  from public.daily_stats ds
  join public.profiles p on p.id = ds.user_id
  where p.device_os = 'android'
    and ds.date = (timezone('utc', now()))::date
    and ds.active_scroll_seconds > 0
)
select
  1 as id,
  case
    when a.total_active_seconds >= 60 and a.sample_reels_scrolled > 0
      then round(
        (a.sample_reels_scrolled::numeric / (a.total_active_seconds::numeric / 60.0)),
        4
      )
    else gc.reels_per_minute
  end as reels_per_minute,
  coalesce(nullif(a.sample_android_users, 0), gc.sample_android_users) as sample_android_users,
  case
    when a.total_active_seconds >= 60
      then greatest(1, (a.total_active_seconds / 60))
    else gc.sample_active_minutes
  end as sample_active_minutes,
  coalesce(nullif(a.sample_reels_scrolled, 0), gc.sample_reels_scrolled) as sample_reels_scrolled,
  greatest(gc.updated_at, now()) as updated_at
from public.global_calibration gc
cross join android_today a;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_stats_set_updated_at on public.daily_stats;
create trigger daily_stats_set_updated_at
  before update on public.daily_stats
  for each row execute function public.set_updated_at();

drop trigger if exists global_calibration_set_updated_at on public.global_calibration;
create trigger global_calibration_set_updated_at
  before update on public.global_calibration
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Upsert helper: increment daily_stats from native bridges
-- ---------------------------------------------------------------------------
create or replace function public.upsert_daily_stats(
  p_user_id uuid,
  p_reels_scrolled integer default 0,
  p_reels_liked integer default 0,
  p_comments_read_or_posted integer default 0,
  p_shares_dmed integer default 0,
  p_active_scroll_seconds integer default 0,
  p_fastest_skip_ms integer default null,
  p_longest_rot_streak_mins integer default null
)
returns public.daily_stats
language plpgsql
security definer
as $$
declare
  result public.daily_stats;
begin
  insert into public.daily_stats (
    user_id,
    date,
    reels_scrolled,
    reels_liked,
    comments_read_or_posted,
    shares_dmed,
    active_scroll_seconds,
    fastest_skip_ms,
    longest_rot_streak_mins
  )
  values (
    p_user_id,
    (timezone('utc', now()))::date,
    greatest(p_reels_scrolled, 0),
    greatest(p_reels_liked, 0),
    greatest(p_comments_read_or_posted, 0),
    greatest(p_shares_dmed, 0),
    greatest(p_active_scroll_seconds, 0),
    coalesce(p_fastest_skip_ms, 0),
    coalesce(p_longest_rot_streak_mins, 0)
  )
  on conflict (user_id, date) do update set
    reels_scrolled = public.daily_stats.reels_scrolled + excluded.reels_scrolled,
    reels_liked = public.daily_stats.reels_liked + excluded.reels_liked,
    comments_read_or_posted = public.daily_stats.comments_read_or_posted + excluded.comments_read_or_posted,
    shares_dmed = public.daily_stats.shares_dmed + excluded.shares_dmed,
    active_scroll_seconds = public.daily_stats.active_scroll_seconds + excluded.active_scroll_seconds,
    fastest_skip_ms = case
      when excluded.fastest_skip_ms > 0 and (
        public.daily_stats.fastest_skip_ms = 0
        or excluded.fastest_skip_ms < public.daily_stats.fastest_skip_ms
      ) then excluded.fastest_skip_ms
      else public.daily_stats.fastest_skip_ms
    end,
    longest_rot_streak_mins = greatest(
      public.daily_stats.longest_rot_streak_mins,
      excluded.longest_rot_streak_mins
    ),
    updated_at = now()
  returning * into result;

  update public.profiles p
  set unc_tier = (
    case
      when result.reels_scrolled <= 50 then 'Gainfully Employed'
      when result.reels_scrolled <= 200 then 'Part-Time Nephew'
      when result.reels_scrolled <= 500 then 'Couch Custodian'
      else 'Senior Facebook Marketplace Lowballer'
    end
  )
  where p.id = p_user_id;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Refresh stored calibration from Android samples (callable by cron / edge)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_global_calibration()
returns public.global_calibration
language plpgsql
security definer
as $$
declare
  result public.global_calibration;
  live record;
begin
  select * into live from public.global_calibration_live;

  update public.global_calibration
  set
    reels_per_minute = live.reels_per_minute,
    sample_android_users = live.sample_android_users,
    sample_active_minutes = live.sample_active_minutes,
    sample_reels_scrolled = live.sample_reels_scrolled,
    updated_at = now()
  where id = 1
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard view (today)
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard_today as
select
  p.id as user_id,
  p.username,
  p.ig_handle,
  p.device_os,
  p.unc_tier,
  p.squad_id,
  p.school_id,
  coalesce(ds.reels_scrolled, 0) as reels_scrolled,
  coalesce(ds.reels_liked, 0) as reels_liked,
  coalesce(ds.comments_read_or_posted, 0) as comments_read_or_posted,
  coalesce(ds.shares_dmed, 0) as shares_dmed,
  coalesce(ds.active_scroll_seconds, 0) as active_scroll_seconds,
  coalesce(ds.fastest_skip_ms, 0) as fastest_skip_ms,
  coalesce(ds.longest_rot_streak_mins, 0) as longest_rot_streak_mins,
  least(
    74.0,
    18.0 + (coalesce(ds.reels_scrolled, 0) * 0.08) + (coalesce(ds.longest_rot_streak_mins, 0) * 0.25)
  ) as unc_age,
  ds.updated_at
from public.profiles p
left join public.daily_stats ds
  on ds.user_id = p.id
 and ds.date = (timezone('utc', now()))::date
order by coalesce(ds.reels_scrolled, 0) desc, unc_age desc;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.daily_stats enable row level security;
alter table public.global_calibration enable row level security;

-- Public read for viral leaderboards / Story share pages
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "daily_stats_public_read" on public.daily_stats;
create policy "daily_stats_public_read"
  on public.daily_stats for select
  using (true);

drop policy if exists "daily_stats_owner_write" on public.daily_stats;
create policy "daily_stats_owner_write"
  on public.daily_stats for insert
  with check (auth.uid() = user_id);

drop policy if exists "daily_stats_owner_update" on public.daily_stats;
create policy "daily_stats_owner_update"
  on public.daily_stats for update
  using (auth.uid() = user_id);

drop policy if exists "global_calibration_public_read" on public.global_calibration;
create policy "global_calibration_public_read"
  on public.global_calibration for select
  using (true);

-- Service role / security definer functions handle writes to calibration.

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.daily_stats;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.global_calibration;

-- Replica identity full so Realtime payloads include old + new rows
alter table public.daily_stats replica identity full;
alter table public.profiles replica identity full;
