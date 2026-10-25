-- Owner gifts: an arcade owner can open every game for any player, by friend code, from the app.
-- Only accounts in arcade_owners can call it; everyone else gets an error. The gift adds unlock
-- rows, which the player's app picks up on its next load through claim_unlocks.

-- Lets the app show the owner tools to owners only (the check that matters is in the gift itself).
create or replace function public.am_arcade_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from arcade_owners where user_id = auth.uid());
$$;

create or replace function public.owner_unlock_all(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target uuid; target_name text; added int;
begin
  if not exists (select 1 from arcade_owners where user_id = auth.uid()) then raise exception 'only the arcade owner can do that'; end if;
  select id, coalesce(display_name, 'Guest ' || friend_code) into target, target_name from profiles where friend_code = upper(trim(p_code));
  if target is null then raise exception 'no player with that friend code'; end if;
  insert into unlocks (user_id, game, reason) select target, game, 'gift' from arcade_ladder() on conflict do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object('name', target_name, 'code', upper(trim(p_code)), 'added', added);
end $$;

revoke all on function public.am_arcade_owner() from public, anon;
revoke all on function public.owner_unlock_all(text) from public, anon;
grant execute on function public.am_arcade_owner() to authenticated;
grant execute on function public.owner_unlock_all(text) to authenticated;

-- First gift: Guest 9CCADAF1.
do $$
declare target uuid;
begin
  select id into target from public.profiles where friend_code = '9CCADAF1';
  if target is null then raise notice 'No player with friend code 9CCADAF1; nothing gifted.';
  else insert into public.unlocks (user_id, game, reason) select target, game, 'gift' from public.arcade_ladder() on conflict do nothing; end if;
end $$;
