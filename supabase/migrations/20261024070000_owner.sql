-- Arcade owners: accounts that can play every game, whatever the play walls say. Owners are stored
-- by account id, never by name, so renaming (or someone later taking the name) moves nothing.
-- Clients can't read or write this table; only claim_unlocks (security definer) looks at it.
create table if not exists public.arcade_owners (
  user_id uuid primary key references auth.users on delete cascade,
  note text,
  added_at timestamptz not null default now()
);
alter table public.arcade_owners enable row level security;
revoke all on public.arcade_owners from public, anon, authenticated;

-- The owner: the player named TopX (names are unique, ignoring case).
do $$
declare owner uuid;
begin
  select id into owner from public.profiles where lower(display_name) = 'topx';
  if owner is null then raise exception 'No player named TopX yet. Set the name in the game first, then run this again.'; end if;
  insert into public.arcade_owners (user_id, note) values (owner, 'TopX, the arcade owner') on conflict do nothing;
  insert into public.unlocks (user_id, game, reason) select owner, game, 'owner' from public.arcade_ladder() on conflict do nothing;
end $$;

-- claim_unlocks, as before, plus: owners get every game on the ladder, including future ones.
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
  if exists (select 1 from arcade_owners where user_id = uid) then
    insert into unlocks (user_id, game, reason) select uid, game, 'owner' from arcade_ladder() on conflict do nothing;
  end if;
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
revoke all on function public.claim_unlocks() from public, anon;
grant execute on function public.claim_unlocks() to authenticated;
