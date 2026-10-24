-- Social, part two: a challenges inbox, a friend activity feed, the Arcade Level board, rank
-- movement and a richer friends list. Run after 20261024040000_kart.sql. Safe to re-run.
-- As before, players never touch these tables directly: everything goes through the security
-- definer functions below, and row level security keeps each player to their own rows.

-- Challenges: "beat my score" sent from one player to another. The score is always the
-- sender's best ranked score from the server, never a number the client supplies.
create table if not exists public.challenges (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users on delete cascade,
  to_id uuid not null references auth.users on delete cascade,
  game text not null check (game ~ '^[a-z]{2,16}$'),
  score bigint not null check (score > 0),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  dismissed boolean not null default false,
  check (from_id <> to_id)
);
create index if not exists challenges_to on public.challenges (to_id, created_at desc);
create index if not exists challenges_from on public.challenges (from_id, created_at desc);
create index if not exists play_sessions_game_user on public.play_sessions (game, user_id, score desc);
create index if not exists play_sessions_user_ended on public.play_sessions (user_id, ended_at desc);
alter table public.challenges enable row level security;
drop policy if exists "read own challenges" on public.challenges;
create policy "read own challenges" on public.challenges for select to authenticated
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));

create or replace function public.best_score(p_user uuid, p_game text)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(max(score), 0) from play_sessions where user_id = p_user and game = p_game and ranked
$$;

create or replace function public.send_challenge(p_code text, p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid; best bigint; recent int;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select id into target from profiles where friend_code = upper(p_code) and is_public;
  if target is null then raise exception 'no player with that code'; end if;
  if target = auth.uid() then raise exception 'that is your own code'; end if;
  best := best_score(auth.uid(), p_game);
  if best <= 0 then raise exception 'finish a ranked run first'; end if;
  select count(*) into recent from challenges where from_id = auth.uid() and created_at > now() - interval '1 day';
  if recent >= 30 then raise exception 'too many challenges today'; end if;
  -- One live challenge per friend and game: a new one replaces the old.
  delete from challenges where from_id = auth.uid() and to_id = target and game = p_game;
  insert into challenges (from_id, to_id, game, score) values (auth.uid(), target, p_game, best);
  return jsonb_build_object('game', p_game, 'score', best,
    'to', (select coalesce(display_name, 'Guest ' || friend_code) from profiles where id = target));
end $$;

-- Both directions for the last 30 days. "beaten" means the challenged player has since posted
-- a higher ranked score in that game; "answer" is their best since the challenge arrived.
create or replace function public.my_challenges()
returns table (id bigint, direction text, player text, friend_code text, avatar jsonb, game text, score bigint,
               created_at timestamptz, seen boolean, beaten boolean, answer bigint)
language sql stable security definer set search_path = public as $$
  select c.id, case when c.to_id = auth.uid() then 'in' else 'out' end,
         coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar, c.game, c.score, c.created_at,
         c.seen_at is not null or c.from_id = auth.uid(), coalesce(a.best, 0) > c.score, coalesce(a.best, 0)
  from challenges c
  join profiles p on p.id = case when c.to_id = auth.uid() then c.from_id else c.to_id end
  left join lateral (select max(s.score) as best from play_sessions s
                     where s.user_id = c.to_id and s.game = c.game and s.ranked and s.ended_at >= c.created_at) a on true
  where ((c.to_id = auth.uid() and not c.dismissed) or c.from_id = auth.uid())
    and c.created_at > now() - interval '30 days'
  order by c.created_at desc
  limit 100
$$;

-- Incoming challenges are dismissed; outgoing ones are withdrawn.
create or replace function public.remove_challenge(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update challenges set dismissed = true where id = p_id and to_id = auth.uid();
  delete from challenges where id = p_id and from_id = auth.uid();
$$;

create or replace function public.mark_challenges_seen()
returns void language sql security definer set search_path = public as $$
  update challenges set seen_at = now() where to_id = auth.uid() and seen_at is null
$$;

-- New personal bests from the people you follow, over the last two weeks, with your own best
-- in the same game so the app can say "beat yours by 2,140".
create or replace function public.friend_feed(p_limit int default 30)
returns table (player text, friend_code text, avatar jsonb, game text, score bigint, achieved_at timestamptz, my_best bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar, s.game, s.score, s.ended_at,
         best_score(auth.uid(), s.game)
  from play_sessions s join profiles p on p.id = s.user_id
  where s.user_id in (select friend_id from follows where user_id = auth.uid())
    and p.is_public and s.ranked and s.score > 0 and s.ended_at > now() - interval '14 days'
    and not exists (select 1 from play_sessions e where e.user_id = s.user_id and e.game = s.game and e.ranked
                    and e.score >= s.score and (e.ended_at < s.ended_at or (e.ended_at = s.ended_at and e.id < s.id)))
  order by s.ended_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

-- The Arcade Level board: everyone ranked by total XP across every game.
create or replace function public.level_board(p_scope text default 'global', p_limit int default 50)
returns table (place bigint, player text, friend_code text, avatar jsonb, level int, xp bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with totals as (select user_id, sum(xp)::bigint as xp from play_sessions group by user_id)
  select rank() over (order by t.xp desc), coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar,
         arcade_level(t.xp), t.xp, t.user_id = auth.uid()
  from totals t join profiles p on p.id = t.user_id
  where (p.is_public or t.user_id = auth.uid())
    and (p_scope <> 'friends' or t.user_id = auth.uid() or t.user_id in (select friend_id from follows where user_id = auth.uid()))
  order by 1
  limit least(greatest(p_limit, 1), 100)
$$;

-- Your place on a board now and 24 hours ago, so the app can show rank movement.
create or replace function public.my_rank(p_game text, p_period text default 'all')
returns jsonb language sql stable security definer set search_path = public as $$
  with now_best as (
    select user_id, max(score) as score from play_sessions
    where game = p_game and ranked and score > 0 and ended_at >= period_start(p_period) group by user_id
  ), then_best as (
    select user_id, max(score) as score from play_sessions
    where game = p_game and ranked and score > 0 and ended_at < now() - interval '1 day'
      and ended_at >= period_start(p_period) - interval '1 day' group by user_id
  ), me_now as (select score from now_best where user_id = auth.uid()),
     me_then as (select score from then_best where user_id = auth.uid())
  select jsonb_build_object('score', (select score from me_now),
    'place', case when exists (select 1 from me_now) then (select count(*) + 1 from now_best where score > (select score from me_now)) end,
    'players', (select count(*) from now_best),
    'prev_place', case when exists (select 1 from me_then) then (select count(*) + 1 from then_best where score > (select score from me_then)) end)
$$;

create or replace function public.my_level_rank()
returns jsonb language sql stable security definer set search_path = public as $$
  with totals as (select user_id, sum(xp)::bigint as xp from play_sessions group by user_id),
       me as (select xp from totals where user_id = auth.uid())
  select jsonb_build_object('xp', coalesce((select xp from me), 0), 'level', arcade_level(coalesce((select xp from me), 0)),
    'place', case when exists (select 1 from me) then (select count(*) + 1 from totals where xp > (select xp from me)) end,
    'players', (select count(*) from totals))
$$;

-- Friends with what they last played and whether they added you back, plus the players who
-- added you that you have not added yet.
drop function if exists public.my_friends();
create or replace function public.my_friends()
returns table (player text, friend_code text, avatar jsonb, level int, last_game text, last_played timestamptz, follows_me boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar,
         arcade_level((select coalesce(sum(xp), 0) from play_sessions where user_id = p.id)),
         l.game, l.ended_at,
         exists (select 1 from follows b where b.user_id = p.id and b.friend_id = auth.uid())
  from follows f join profiles p on p.id = f.friend_id
  left join lateral (select s.game, s.ended_at from play_sessions s where s.user_id = p.id order by s.ended_at desc limit 1) l on true
  where f.user_id = auth.uid() and p.is_public
  order by l.ended_at desc nulls last, 1
$$;

create or replace function public.my_followers()
returns table (player text, friend_code text, avatar jsonb, level int, added_at timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar,
         arcade_level((select coalesce(sum(xp), 0) from play_sessions where user_id = p.id)), f.created_at
  from follows f join profiles p on p.id = f.user_id
  where f.friend_id = auth.uid() and p.is_public
    and not exists (select 1 from follows m where m.user_id = auth.uid() and m.friend_id = f.user_id)
  order by f.created_at desc
  limit 100
$$;

create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  delete from saves where user_id = auth.uid();
  delete from play_sessions where user_id = auth.uid();
  delete from unlocks where user_id = auth.uid();
  delete from follows where user_id = auth.uid() or friend_id = auth.uid();
  delete from challenges where from_id = auth.uid() or to_id = auth.uid();
  delete from profiles where id = auth.uid();
end $$;

-- best_score is an internal helper; only the functions above may call it.
revoke all on function public.best_score(uuid, text) from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array['send_challenge(text, text)', 'my_challenges()', 'remove_challenge(bigint)', 'mark_challenges_seen()',
    'friend_feed(int)', 'level_board(text, int)', 'my_rank(text, text)', 'my_level_rank()', 'my_friends()', 'my_followers()',
    'delete_my_data()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
