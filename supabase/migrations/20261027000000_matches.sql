-- Matches: a challenge that sets up a real game between two players, whenever each is online.
-- Score games: both play the same seeded course; the higher score wins. Chess: a real game,
-- the challenger plays white, and moves are taken in turn. Invites: opening a friend's invite
-- link makes the two of you friends both ways, even if the inviter is offline.
-- Run after 20261024080000_owner_gifts.sql. Safe to re-run.

create table if not exists public.matches (
  id bigint generated always as identity primary key,
  game text not null,
  seed bigint not null,
  from_id uuid not null references auth.users on delete cascade,
  to_id uuid not null references auth.users on delete cascade,
  from_score bigint, to_score bigint,
  from_at timestamptz, to_at timestamptz,
  moves text[] not null default '{}',
  result text,                 -- chess: checkmate | stalemate | draw | resign; score games: null
  winner uuid,                 -- null for a draw or while open
  status text not null default 'open' check (status in ('open', 'done', 'declined')),
  from_seen timestamptz, to_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists matches_from on public.matches (from_id, updated_at desc);
create index if not exists matches_to on public.matches (to_id, updated_at desc);
alter table public.matches enable row level security;
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select using (auth.uid() in (from_id, to_id));
revoke insert, update, delete on public.matches from anon, authenticated;

-- Start a match with a player by friend code. No earlier score needed.
create or replace function public.create_match(p_code text, p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid; recent int; m public.matches;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_game not in ('classic', 'rush', 'flappy', 'cross', 'snake', 'runner', 'turbo', 'pinball', 'kart', 'chess') then raise exception 'that game has no matches'; end if;
  select id into target from profiles where friend_code = upper(trim(p_code));
  if target is null then raise exception 'no player with that code'; end if;
  if target = auth.uid() then raise exception 'that is your own code'; end if;
  select count(*) into recent from matches where from_id = auth.uid() and created_at > now() - interval '1 day';
  if recent >= 40 then raise exception 'too many matches today'; end if;
  insert into matches (game, seed, from_id, to_id, from_seen)
  values (p_game, floor(random() * 2147483646)::bigint + 1, auth.uid(), target, now()) returning * into m;
  -- Starting a match makes you friends, so it shows on both Friends tabs.
  insert into follows (user_id, friend_id) values (auth.uid(), target), (target, auth.uid()) on conflict do nothing;
  return jsonb_build_object('id', m.id, 'game', m.game, 'seed', m.seed,
    'to', (select coalesce(display_name, 'Guest ' || friend_code) from profiles where id = target));
end $$;

-- Your matches, newest activity first, from your side of the board.
create or replace function public.my_matches()
returns table (id bigint, role text, player text, friend_code text, avatar jsonb, game text, seed bigint,
               my_score bigint, their_score bigint, moves text[], result text, outcome text, status text,
               seen boolean, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, case when m.from_id = auth.uid() then 'from' else 'to' end,
         coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar, m.game, m.seed,
         case when m.from_id = auth.uid() then m.from_score else m.to_score end,
         case when m.from_id = auth.uid() then m.to_score else m.from_score end,
         m.moves, m.result,
         case when m.status <> 'done' then null when m.winner is null then 'draw' when m.winner = auth.uid() then 'win' else 'loss' end,
         m.status,
         (case when m.from_id = auth.uid() then m.from_seen else m.to_seen end) >= m.updated_at,
         m.created_at, m.updated_at
  from matches m
  join profiles p on p.id = case when m.from_id = auth.uid() then m.to_id else m.from_id end
  where auth.uid() in (m.from_id, m.to_id) and m.updated_at > now() - interval '30 days'
  order by m.updated_at desc
  limit 100
$$;

-- A score game finished: records your score once, capped at what a run that long can earn.
create or replace function public.submit_match_score(p_id bigint, p_score bigint, p_seconds int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.matches; s bigint;
begin
  select * into m from matches where id = p_id and auth.uid() in (from_id, to_id) for update;
  if m.id is null then raise exception 'no such match'; end if;
  if m.game = 'chess' or m.status <> 'open' then raise exception 'that match is finished'; end if;
  s := least(greatest(p_score, 0), score_cap(m.game, greatest(p_seconds, 1)));
  if m.from_id = auth.uid() then
    if m.from_score is not null then raise exception 'you already played this match'; end if;
    update matches set from_score = s, from_at = now(), from_seen = now(), updated_at = now() where id = p_id returning * into m;
  else
    if m.to_score is not null then raise exception 'you already played this match'; end if;
    update matches set to_score = s, to_at = now(), to_seen = now(), updated_at = now() where id = p_id returning * into m;
  end if;
  if m.from_score is not null and m.to_score is not null then
    update matches set status = 'done', updated_at = now(),
      winner = case when m.from_score > m.to_score then m.from_id when m.to_score > m.from_score then m.to_id else null end
    where id = p_id returning * into m;
  end if;
  return jsonb_build_object('status', m.status, 'my_score', s,
    'their_score', case when m.from_id = auth.uid() then m.to_score else m.from_score end,
    'outcome', case when m.status <> 'done' then null when m.winner is null then 'draw' when m.winner = auth.uid() then 'win' else 'loss' end);
end $$;

-- Chess: plays your move (UCI, like e2e4 or e7e8q) if it's your turn. The challenger is white.
-- p_result ends the game: 'checkmate' (the mover wins), 'stalemate' or 'draw' (no winner), 'resign' (the mover loses).
create or replace function public.chess_move(p_id bigint, p_ply int, p_move text, p_result text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.matches; white boolean; n int;
begin
  select * into m from matches where id = p_id and auth.uid() in (from_id, to_id) for update;
  if m.id is null then raise exception 'no such match'; end if;
  if m.game <> 'chess' or m.status <> 'open' then raise exception 'that match is finished'; end if;
  white := m.from_id = auth.uid();n := coalesce(array_length(m.moves, 1), 0);
  if p_result = 'resign' then
    update matches set status = 'done', result = 'resign', winner = case when white then to_id else from_id end, updated_at = now() where id = p_id;
    return jsonb_build_object('status', 'done', 'ply', n);
  end if;
  if p_ply <> n then raise exception 'out of turn'; end if;
  if (n % 2 = 0) <> white then raise exception 'not your turn'; end if;
  if p_move !~ '^[a-h][1-8][a-h][1-8][qrbn]?$' then raise exception 'bad move'; end if;
  update matches set moves = moves || p_move, updated_at = now(),
    from_seen = case when white then now() else from_seen end, to_seen = case when white then to_seen else now() end,
    status = case when p_result in ('checkmate', 'stalemate', 'draw') then 'done' else status end,
    result = case when p_result in ('checkmate', 'stalemate', 'draw') then p_result else result end,
    winner = case when p_result = 'checkmate' then auth.uid() else winner end
  where id = p_id;
  return jsonb_build_object('status', case when p_result in ('checkmate', 'stalemate', 'draw') then 'done' else 'open' end, 'ply', n + 1);
end $$;

create or replace function public.decline_match(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update matches set status = 'declined', updated_at = now()
  where id = p_id and auth.uid() in (from_id, to_id) and status = 'open'
$$;

create or replace function public.mark_matches_seen()
returns void language sql security definer set search_path = public as $$
  update matches set from_seen = now() where from_id = auth.uid() and (from_seen is null or from_seen < updated_at);
  update matches set to_seen = now() where to_id = auth.uid() and (to_seen is null or to_seen < updated_at);
$$;

-- Opening a friend's invite link: the two of you become friends both ways.
create or replace function public.accept_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select id into target from profiles where friend_code = upper(trim(p_code));
  if target is null then raise exception 'no player with that code'; end if;
  if target = auth.uid() then return public_profile(p_code); end if;
  insert into follows (user_id, friend_id) values (auth.uid(), target), (target, auth.uid()) on conflict do nothing;
  return public_profile(p_code);
end $$;

-- Deleting your data removes your matches too.
create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public as $
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  delete from saves where user_id = auth.uid();
  delete from play_sessions where user_id = auth.uid();
  delete from unlocks where user_id = auth.uid();
  delete from follows where user_id = auth.uid() or friend_id = auth.uid();
  delete from challenges where from_id = auth.uid() or to_id = auth.uid();
  delete from matches where from_id = auth.uid() or to_id = auth.uid();
  delete from profiles where id = auth.uid();
end $;

do $
declare f text;
begin
  foreach f in array array['create_match(text, text)', 'my_matches()', 'submit_match_score(bigint, bigint, int)',
    'chess_move(bigint, int, text, text)', 'decline_match(bigint)', 'mark_matches_seen()', 'accept_invite(text)', 'delete_my_data()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
