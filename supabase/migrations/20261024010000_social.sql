-- DAWG Arcade social layer: public player names, DAWG avatars, friend codes, follows,
-- global and friends leaderboards, global stats and score plausibility checks.
-- Run after 20261024000000_arcade.sql. Safe to re-run.
-- Public data is exposed only through the functions below; tables stay owner-only under RLS.

alter table public.profiles add column if not exists friend_code text;
alter table public.profiles add column if not exists avatar jsonb check (avatar is null or pg_column_size(avatar) < 16384);
alter table public.profiles add column if not exists is_public boolean not null default true;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
update public.profiles set friend_code = upper(substr(md5(random()::text || id::text), 1, 8)) where friend_code is null;
alter table public.profiles alter column friend_code set default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
alter table public.profiles alter column friend_code set not null;
create unique index if not exists profiles_friend_code on public.profiles (friend_code);
create unique index if not exists profiles_name_ci on public.profiles (lower(display_name)) where display_name is not null;

-- Runs whose score is impossible for their length are kept for play time but never ranked.
alter table public.play_sessions add column if not exists ranked boolean not null default true;
create index if not exists play_sessions_board on public.play_sessions (game, score desc) where ranked;
create index if not exists play_sessions_recent on public.play_sessions (ended_at);

create table if not exists public.follows (
  user_id uuid not null references auth.users on delete cascade,
  friend_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.follows enable row level security;
drop policy if exists "read own follows" on public.follows;
create policy "read own follows" on public.follows for select to authenticated using (user_id = (select auth.uid()));

-- Player names: 3–16 letters, digits, spaces, _ . -; obvious slurs and profanity are refused
-- (also after common letter swaps like 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s).
create or replace function public.name_ok(p_name text)
returns boolean language sql immutable as $$
  select p_name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{1,14}[A-Za-z0-9]$'
     and translate(lower(p_name), '013457@$ _.-', 'oieastas') !~ '(fuck|shit|bitch|cunt|nigg|fag|rape|nazi|hitler|porn|dick|cock|pussy|whore|slut|retard|kys)'
$$;

-- Generous per-game ceilings on score per second of active play.
create or replace function public.score_cap(p_game text, p_seconds int)
returns bigint language sql immutable as $$
  select case p_game
    when 'runner' then 120 * p_seconds + 1000
    when 'flappy' then 25 * p_seconds + 200
    when 'snake' then 80 * p_seconds + 1200
    when 'cross' then 60 * p_seconds + 500
    when 'story' then 5000
    when 'trade' then 100000000
    else 600 * p_seconds + 5000
  end
$$;

create or replace function public.record_session(p_game text, p_local_day date, p_started_at timestamptz, p_ended_at timestamptz, p_active_seconds int, p_score bigint, p_xp int, p_gold int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  span int;
  secs int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if p_ended_at > now() + interval '2 minutes' or p_started_at > p_ended_at or p_ended_at < now() - interval '7 days' then
    raise exception 'session times out of range';
  end if;
  if abs(p_local_day - (p_ended_at at time zone 'utc')::date) > 1 then raise exception 'local day out of range'; end if;
  span := extract(epoch from (p_ended_at - p_started_at))::int;
  if exists (select 1 from play_sessions where user_id = uid and started_at < p_ended_at and ended_at > p_started_at) then
    raise exception 'overlapping session';
  end if;
  secs := least(greatest(p_active_seconds, 0), span, 3600);
  insert into profiles (id) values (uid) on conflict (id) do nothing;
  insert into play_sessions (user_id, game, local_day, started_at, ended_at, active_seconds, score, xp, gold, ranked)
  values (uid, p_game, p_local_day, p_started_at, p_ended_at, secs, greatest(p_score, 0),
          least(greatest(p_xp, 0), 400, 10 + span), greatest(coalesce(p_gold, 0), 0),
          greatest(p_score, 0) <= score_cap(p_game, greatest(secs, 1)));
end $$;

-- Creates the caller's profile on first use and returns it.
create or replace function public.ensure_profile()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r profiles;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  select * into r from profiles where id = auth.uid();
  return jsonb_build_object('name', r.display_name, 'code', r.friend_code, 'avatar', r.avatar, 'public', r.is_public);
end $$;

-- Sets the public name (null keeps the automatic one), DAWG avatar and visibility.
create or replace function public.set_profile(p_name text, p_avatar jsonb, p_public boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare clean text := nullif(btrim(p_name), '');
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if clean is not null and not name_ok(clean) then raise exception 'name not allowed'; end if;
  if clean is not null and exists (select 1 from profiles where lower(display_name) = lower(clean) and id <> auth.uid()) then raise exception 'name taken'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  update profiles set display_name = clean, avatar = p_avatar, is_public = coalesce(p_public, true), updated_at = now() where id = auth.uid();
  return ensure_profile();
end $$;

create or replace function public.period_start(p_period text)
returns timestamptz language sql stable as $$
  select case p_period when 'day' then now() - interval '1 day' when 'week' then now() - interval '7 days' else '-infinity'::timestamptz end
$$;

-- Best ranked score per player. scope 'friends' = you plus everyone you follow.
create or replace function public.leaderboard(p_game text, p_period text default 'all', p_scope text default 'global', p_limit int default 50)
returns table (place bigint, player text, friend_code text, avatar jsonb, score bigint, achieved_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (s.user_id) s.user_id, s.score, s.ended_at
    from play_sessions s
    where s.game = p_game and s.ranked and s.score > 0 and s.ended_at >= period_start(p_period)
      and (p_scope <> 'friends' or s.user_id = auth.uid() or s.user_id in (select friend_id from follows where user_id = auth.uid()))
    order by s.user_id, s.score desc, s.ended_at asc
  )
  select rank() over (order by b.score desc, b.ended_at asc), coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code,
         p.avatar, b.score, b.ended_at, b.user_id = auth.uid()
  from best b join profiles p on p.id = b.user_id
  where p.is_public or b.user_id = auth.uid()
  order by 1, b.ended_at
  limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.my_standing(p_game text, p_period text default 'all')
returns jsonb language sql stable security definer set search_path = public as $$
  with best as (
    select s.user_id, max(s.score) as score from play_sessions s
    where s.game = p_game and s.ranked and s.score > 0 and s.ended_at >= period_start(p_period)
    group by s.user_id
  ), me as (select score from best where user_id = auth.uid())
  select jsonb_build_object('score', (select score from me),
    'place', case when exists (select 1 from me) then (select count(*) + 1 from best where score > (select score from me)) end,
    'players', (select count(*) from best))
$$;

create or replace function public.global_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'players', (select count(distinct user_id) from play_sessions),
    'runs', (select count(*) from play_sessions),
    'runs_today', (select count(*) from play_sessions where ended_at > now() - interval '1 day'),
    'hours', (select round(coalesce(sum(active_seconds), 0) / 3600.0, 1) from play_sessions),
    'by_game', coalesce((select jsonb_object_agg(game, n) from (select game, count(*) n from play_sessions group by game) g), '{}'::jsonb))
$$;

-- Public card for a friend code: name, DAWG avatar, level and best scores.
create or replace function public.public_profile(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', coalesce(p.display_name, 'Guest ' || p.friend_code), 'code', p.friend_code, 'avatar', p.avatar,
    'level', arcade_level((select coalesce(sum(xp), 0) from play_sessions where user_id = p.id)),
    'best', coalesce((select jsonb_object_agg(game, best) from (select game, max(score) best from play_sessions where user_id = p.id and ranked group by game) g), '{}'::jsonb),
    'following', exists (select 1 from follows where user_id = auth.uid() and friend_id = p.id))
  from profiles p where p.friend_code = upper(p_code) and (p.is_public or p.id = auth.uid())
$$;

create or replace function public.follow_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select id into target from profiles where friend_code = upper(p_code) and is_public;
  if target is null then raise exception 'no player with that code'; end if;
  if target = auth.uid() then raise exception 'that is your own code'; end if;
  if (select count(*) from follows where user_id = auth.uid()) >= 500 then raise exception 'friend list is full'; end if;
  insert into follows (user_id, friend_id) values (auth.uid(), target) on conflict do nothing;
  return public_profile(p_code);
end $$;

create or replace function public.unfollow_code(p_code text)
returns void language sql security definer set search_path = public as $$
  delete from follows where user_id = auth.uid() and friend_id = (select id from profiles where friend_code = upper(p_code))
$$;

create or replace function public.my_friends()
returns table (player text, friend_code text, avatar jsonb, level int)
language sql stable security definer set search_path = public as $$
  select coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar,
         arcade_level((select coalesce(sum(xp), 0) from play_sessions where user_id = p.id))
  from follows f join profiles p on p.id = f.friend_id
  where f.user_id = auth.uid() and p.is_public
  order by 1
$$;

create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  delete from saves where user_id = auth.uid();
  delete from play_sessions where user_id = auth.uid();
  delete from unlocks where user_id = auth.uid();
  delete from follows where user_id = auth.uid() or friend_id = auth.uid();
  delete from profiles where id = auth.uid();
end $$;

do $$
declare f text;
begin
  foreach f in array array['ensure_profile()', 'set_profile(text, jsonb, boolean)', 'leaderboard(text, text, text, int)', 'my_standing(text, text)',
    'global_stats()', 'public_profile(text)', 'follow_code(text)', 'unfollow_code(text)', 'my_friends()', 'delete_my_data()',
    'record_session(text, date, timestamptz, timestamptz, int, bigint, int, int)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
