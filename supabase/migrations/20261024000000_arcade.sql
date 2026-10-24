-- DAWG Arcade: player saves, play sessions and verified unlocks.
-- Run once in the Supabase SQL Editor (or `supabase db push`). Safe to re-run.
-- Data is encrypted in transit (TLS) and at rest (Supabase disk encryption). Row Level
-- Security lets each signed-in player (guest or email) read and write only their own rows.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  display_name text check (char_length(display_name) <= 40)
);

-- One row per save section (records, kennel, settings, arcade, ...), mirrored from the browser.
create table if not exists public.saves (
  user_id uuid not null references auth.users on delete cascade,
  key text not null check (key ~ '^[a-zA-Z]{2,24}$'),
  data jsonb not null check (pg_column_size(data) < 262144),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- One row per finished run. Written only through record_session(), which caps the numbers.
create table if not exists public.play_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  game text not null check (game ~ '^[a-z]{2,16}$'),
  local_day date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  active_seconds integer not null check (active_seconds between 0 and 3600),
  score bigint not null check (score >= 0),
  xp integer not null check (xp between 0 and 400),
  gold integer not null default 0 check (gold >= 0)
);
create index if not exists play_sessions_user_day on public.play_sessions (user_id, local_day);

-- Games the server has verified as unlocked. Players can read but never write these directly.
create table if not exists public.unlocks (
  user_id uuid not null references auth.users on delete cascade,
  game text not null,
  unlocked_at timestamptz not null default now(),
  reason text not null,
  primary key (user_id, game)
);

alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.play_sessions enable row level security;
alter table public.unlocks enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "own saves" on public.saves;
create policy "own saves" on public.saves for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "read own sessions" on public.play_sessions;
create policy "read own sessions" on public.play_sessions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "read own unlocks" on public.unlocks;
create policy "read own unlocks" on public.unlocks for select to authenticated using (user_id = (select auth.uid()));

-- Unlock ladder. Keep in step with dist/unlocks.js (a test compares the two).
create or replace function public.arcade_ladder()
returns table (game text, min_level int, min_minutes int, min_streak int, challenge text)
language sql immutable as $$
  values
    ('snake', 3, 20, 2, null::text),
    ('rush', 4, 30, null::int, null::text),
    ('daily', 4, 30, null::int, null::text),
    ('cross', 5, 45, 3, null::text),
    ('trade', 6, 60, null::int, 'dash100'),
    ('story', 10, 120, 5, null::text)
$$;

create or replace function public.arcade_level(total_xp bigint)
returns int language sql immutable as $$
  select coalesce(max(n), 1)::int from generate_series(1, 99) n where total_xp >= round(150 * power(greatest(n - 1, 0), 1.6))
$$;

-- Stores one finished run. The server, not the client, bounds time and XP so a modified
-- client cannot award itself hours of play from a single request.
create or replace function public.record_session(p_game text, p_local_day date, p_started_at timestamptz, p_ended_at timestamptz, p_active_seconds int, p_score bigint, p_xp int, p_gold int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  span int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if p_ended_at > now() + interval '2 minutes' or p_started_at > p_ended_at or p_ended_at < now() - interval '7 days' then
    raise exception 'session times out of range';
  end if;
  if abs(p_local_day - (p_ended_at at time zone 'utc')::date) > 1 then raise exception 'local day out of range'; end if;
  span := extract(epoch from (p_ended_at - p_started_at))::int;
  -- No two sessions may overlap: active time can only be spent once.
  if exists (select 1 from play_sessions where user_id = uid and started_at < p_ended_at and ended_at > p_started_at) then
    raise exception 'overlapping session';
  end if;
  insert into play_sessions (user_id, game, local_day, started_at, ended_at, active_seconds, score, xp, gold)
  values (uid, p_game, p_local_day, p_started_at, p_ended_at,
          least(greatest(p_active_seconds, 0), span, 3600),
          greatest(p_score, 0),
          least(greatest(p_xp, 0), 400, 10 + span),
          greatest(coalesce(p_gold, 0), 0));
end $$;

-- Recomputes level, play time, streak and challenges from stored sessions, records any newly
-- earned unlocks and returns the player's verified progress.
create or replace function public.claim_unlocks()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  total_xp bigint; total_seconds bigint; lvl int; streak int := 0; dash100 boolean;
  r record;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select coalesce(sum(xp), 0), coalesce(sum(active_seconds), 0) into total_xp, total_seconds from play_sessions where user_id = uid;
  lvl := arcade_level(total_xp);
  -- Longest run of consecutive played days.
  select coalesce(max(len), 0) into streak from (
    select count(*) as len from (
      select local_day, local_day - (row_number() over (order by local_day))::int as grp
      from (select distinct local_day from play_sessions where user_id = uid) days
    ) g group by grp
  ) runs;
  select exists (select 1 from play_sessions where user_id = uid and game = 'runner' and gold >= 100) into dash100;
  for r in select * from arcade_ladder() loop
    if (lvl >= r.min_level) or (total_seconds >= r.min_minutes * 60) or (r.min_streak is not null and streak >= r.min_streak) or (r.challenge = 'dash100' and dash100) then
      insert into unlocks (user_id, game, reason) values (uid, r.game,
        case when lvl >= r.min_level then 'level' when total_seconds >= r.min_minutes * 60 then 'time' when r.min_streak is not null and streak >= r.min_streak then 'streak' else 'challenge' end)
      on conflict do nothing;
    end if;
  end loop;
  return jsonb_build_object('xp', total_xp, 'level', lvl, 'seconds', total_seconds, 'streak', streak,
    'unlocked', coalesce((select jsonb_object_agg(game, reason) from unlocks where user_id = uid), '{}'::jsonb));
end $$;

-- Removes everything this player has stored. The sign-in record itself is removed by the
-- account's owner from the dashboard or by a future admin function.
create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  delete from saves where user_id = auth.uid();
  delete from play_sessions where user_id = auth.uid();
  delete from unlocks where user_id = auth.uid();
  delete from profiles where id = auth.uid();
end $$;

revoke all on function public.record_session(text, date, timestamptz, timestamptz, int, bigint, int, int) from public, anon;
revoke all on function public.claim_unlocks() from public, anon;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.record_session(text, date, timestamptz, timestamptz, int, bigint, int, int) to authenticated;
grant execute on function public.claim_unlocks() to authenticated;
grant execute on function public.delete_my_data() to authenticated;
