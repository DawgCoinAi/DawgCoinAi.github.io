-- DAWG Chat: one public room where players talk and share game moments (finishing moves, scores).
-- Every signed-in player, guests included, can read. Nobody writes to the tables directly: posts,
-- reactions, reports, deletes and mutes all go through the functions below, which check the text,
-- the moment's shape and size, and how fast the player is posting.
-- Run after 20261027000000_matches.sql (it needs profiles, name_ok's word rules, arcade_level,
-- arcade_owners). Safe to re-run. Needs no secret key.

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  author uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  body text not null default '' check (char_length(body) <= 240),
  moment jsonb check (moment is null or pg_column_size(moment) < 4096),
  room text not null default 'lobby',
  hidden boolean not null default false,   -- enough players reported it
  deleted boolean not null default false   -- removed by its author or an arcade owner; kept (emptied) so rate limits still count it
);
create index if not exists chat_messages_room on public.chat_messages (room, id desc);
create index if not exists chat_messages_author on public.chat_messages (author, created_at desc);
alter table public.chat_messages enable row level security;
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select to authenticated
  using (not deleted and (not hidden or author = (select auth.uid())));
revoke all on public.chat_messages from anon;
revoke insert, update, delete, truncate on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;

-- One reaction per player per message.
create table if not exists public.chat_reactions (
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.chat_reactions enable row level security;
drop policy if exists chat_reactions_read on public.chat_reactions;
create policy chat_reactions_read on public.chat_reactions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.chat_reactions from anon;
revoke insert, update, delete, truncate on public.chat_reactions from anon, authenticated;

-- One report per player per message. Clients can't read reports at all.
create table if not exists public.chat_reports (
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists chat_reports_user on public.chat_reports (user_id, created_at desc);
alter table public.chat_reports enable row level security;
revoke all on public.chat_reports from public, anon, authenticated;

-- Players an arcade owner has muted, and until when. Clients can't read it.
create table if not exists public.chat_mutes (
  user_id uuid primary key references auth.users on delete cascade,
  until timestamptz not null,
  muted_by uuid,
  created_at timestamptz not null default now()
);
alter table public.chat_mutes enable row level security;
revoke all on public.chat_mutes from public, anon, authenticated;

-- Tidies text: control and invisible direction characters become spaces, runs of spaces collapse.
create or replace function public.chat_clean(p_text text)
returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]\u200B-\u200F\u2028-\u202E\u2066-\u2069\uFEFF]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- The same word rules as player names (name_ok in 20261024020000_turbo.sql), applied to chat text:
-- letter swaps are undone first; unambiguous slurs are refused anywhere, words that hide inside
-- ordinary ones only as a whole word, at the end of a word, or with an insulting suffix.
create or replace function public.chat_text_ok(p_text text)
returns boolean language sql immutable as $$
  select not (t ~ '(fuck|nigg|bitch|whore|retard|hitler|nazi|pussy|cunt([^h]|$)|\mkys\M)'
           or t ~ '(dick|cock|shit|slut|porn)(s|head|face|hole|bag|lord|wad|ty|y|z|er|ers)?\M'
           or t ~ '\m(rape|raper|rapist|fag|fags|faggot)\M')
  from (select translate(lower(coalesce(p_text, '')), '013457@$_.-', 'oieastas   ') as t) n
$$;

-- A moment's replay recipe: a flat object of short strings, numbers, booleans and short arrays
-- of numbers. No nested objects, no nulls, no markup.
create or replace function public.chat_data_ok(p_data jsonb)
returns boolean language plpgsql immutable as $$
declare k text; v jsonb; n int := 0;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then return false; end if;
  -- jsonb prints with a space after every colon and comma, so 1500 bytes of compact JSON fit in 2400.
  if octet_length(p_data::text) > 2400 then return false; end if;
  for k, v in select key, value from jsonb_each(p_data) loop
    n := n + 1;
    if n > 32 or k !~ '^[A-Za-z_][A-Za-z0-9_]{0,23}$' then return false; end if;
    if jsonb_typeof(v) = 'string' then
      if char_length(v #>> '{}') > 40 or (v #>> '{}') ~ '[<>[:cntrl:]]' then return false; end if;
    elsif jsonb_typeof(v) = 'array' then
      if jsonb_array_length(v) > 64 then return false; end if;
      if exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'number') then return false; end if;
    elsif jsonb_typeof(v) not in ('number', 'boolean') then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- A moment: {kind, game, title ≤ 60, text ≤ 120 (optional), data}. Nothing else is accepted.
create or replace function public.chat_moment_ok(p_moment jsonb)
returns boolean language plpgsql immutable as $$
begin
  if p_moment is null or jsonb_typeof(p_moment) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(p_moment) k where k not in ('kind', 'game', 'title', 'text', 'data')) then return false; end if;
  if jsonb_typeof(p_moment -> 'kind') is distinct from 'string' or (p_moment ->> 'kind') !~ '^[a-z][a-z0-9_]{1,15}$' then return false; end if;
  if jsonb_typeof(p_moment -> 'game') is distinct from 'string' or (p_moment ->> 'game') !~ '^[a-z][a-z0-9_-]{1,15}$' then return false; end if;
  if jsonb_typeof(p_moment -> 'title') is distinct from 'string' then return false; end if;
  if char_length(chat_clean(p_moment ->> 'title')) not between 1 and 60 then return false; end if;
  if p_moment ? 'text' and (jsonb_typeof(p_moment -> 'text') <> 'string' or char_length(chat_clean(p_moment ->> 'text')) > 120) then return false; end if;
  if (p_moment ->> 'title') ~ '[<>]' or coalesce(p_moment ->> 'text', '') ~ '[<>]' then return false; end if;
  return chat_data_ok(p_moment -> 'data');
end $$;

-- Post to the lobby: text (up to 240 characters), a moment, or both.
-- Limits per player: one message every 3 seconds, 20 in 5 minutes, and the same message again
-- only after 2 minutes. Players hidden from public boards can read but not post.
create or replace function public.chat_post(p_body text default '', p_moment jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean text := chat_clean(p_body);
  shown boolean; muted timestamptz; last_at timestamptz; recent int; mom jsonb; m public.chat_messages;
begin
  if uid is null then raise exception 'sign in first'; end if;
  insert into profiles (id) values (uid) on conflict (id) do nothing;
  select is_public into shown from profiles where id = uid;
  if not coalesce(shown, true) then raise exception 'chat is for players shown on public boards'; end if;
  select until into muted from chat_mutes where user_id = uid and until > now();
  if muted is not null then
    raise exception 'chat muted for % more minutes', greatest(1, ceil(extract(epoch from (muted - now())) / 60)::int);
  end if;
  if char_length(clean) > 240 then raise exception 'message too long'; end if;
  if clean = '' and p_moment is null then raise exception 'empty message'; end if;
  if not chat_text_ok(clean) then raise exception 'message not allowed'; end if;
  if p_moment is not null then
    if not chat_moment_ok(p_moment) then raise exception 'bad moment'; end if;
    mom := jsonb_build_object('kind', p_moment ->> 'kind', 'game', p_moment ->> 'game',
      'title', chat_clean(p_moment ->> 'title'), 'text', chat_clean(p_moment ->> 'text'), 'data', p_moment -> 'data');
    if not chat_text_ok((mom ->> 'title') || ' ' || (mom ->> 'text')) then raise exception 'message not allowed'; end if;
  end if;
  -- One post at a time per player, so two tabs can't slip past the limits together.
  perform pg_advisory_xact_lock(hashtext('chat:' || uid::text));
  select max(created_at) into last_at from chat_messages where author = uid;
  if last_at is not null and last_at > now() - interval '3 seconds' then raise exception 'slow down'; end if;
  select count(*) into recent from chat_messages where author = uid and created_at > now() - interval '5 minutes';
  if recent >= 20 then raise exception 'too many messages'; end if;
  if exists (select 1 from chat_messages where author = uid and created_at > now() - interval '2 minutes'
             and not deleted and body = clean and moment is not distinct from mom) then
    raise exception 'duplicate message';
  end if;
  insert into chat_messages (author, body, moment) values (uid, clean, mom) returning * into m;
  return jsonb_build_object('id', m.id, 'created_at', m.created_at);
end $$;

-- The newest messages in a room, newest first; pass the oldest id you have as p_before for the
-- page before it. Reported-away and removed messages, messages you reported, and players who
-- have since hidden themselves from public boards are left out.
create or replace function public.chat_recent(p_room text default 'lobby', p_before bigint default null, p_limit int default 50)
returns table (id bigint, created_at timestamptz, body text, moment jsonb, player text, friend_code text, avatar jsonb,
               level int, mine boolean, reactions jsonb, my_reaction text)
language sql stable security definer set search_path = public as $$
  select m.id, m.created_at, m.body, m.moment, coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar,
         arcade_level((select coalesce(sum(s.xp), 0) from play_sessions s where s.user_id = m.author)),
         m.author = auth.uid(),
         coalesce((select jsonb_object_agg(r.emoji, r.n) from (select c.emoji, count(*) as n from chat_reactions c where c.message_id = m.id group by c.emoji) r), '{}'::jsonb),
         (select c.emoji from chat_reactions c where c.message_id = m.id and c.user_id = auth.uid())
  from chat_messages m join profiles p on p.id = m.author
  where auth.uid() is not null
    and m.room = coalesce(p_room, 'lobby')
    and not m.deleted
    and (not m.hidden or m.author = auth.uid())
    and (p.is_public or m.author = auth.uid())
    and (p_before is null or m.id < p_before)
    and not exists (select 1 from chat_reports x where x.message_id = m.id and x.user_id = auth.uid())
  order by m.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

-- React with one of the six chat emoji. The same emoji again (or null) takes your reaction back.
create or replace function public.chat_react(p_id bigint, p_emoji text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); had text;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if p_emoji is not null and p_emoji not in ('🔥', '😂', '👏', '💀', '🐶', '💜') then raise exception 'unknown reaction'; end if;
  if not exists (select 1 from chat_messages where id = p_id and not deleted and not hidden) then raise exception 'no such message'; end if;
  select emoji into had from chat_reactions where message_id = p_id and user_id = uid;
  if p_emoji is null or had = p_emoji then
    delete from chat_reactions where message_id = p_id and user_id = uid;
  else
    insert into chat_reactions (message_id, user_id, emoji) values (p_id, uid, p_emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
  return jsonb_build_object(
    'reactions', coalesce((select jsonb_object_agg(r.emoji, r.n) from (select emoji, count(*) as n from chat_reactions where message_id = p_id group by emoji) r), '{}'::jsonb),
    'mine', (select emoji from chat_reactions where message_id = p_id and user_id = uid));
end $$;

-- Report a message. You stop seeing it straight away; once 3 different players who have played
-- at least one run report it, it is hidden from everyone. 30 reports a day per player.
create or replace function public.chat_report(p_id bigint, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.chat_messages; today int; votes int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select * into m from chat_messages where id = p_id and not deleted;
  if m.id is null then raise exception 'no such message'; end if;
  if m.author = uid then raise exception 'that is your own message'; end if;
  select count(*) into today from chat_reports where user_id = uid and created_at > now() - interval '1 day';
  if today >= 30 then raise exception 'too many reports today'; end if;
  insert into chat_reports (message_id, user_id, reason) values (p_id, uid, left(chat_clean(p_reason), 200)) on conflict do nothing;
  select count(*) into votes from chat_reports r
    where r.message_id = p_id and exists (select 1 from play_sessions s where s.user_id = r.user_id);
  if votes >= 3 and not m.hidden then update chat_messages set hidden = true where id = p_id; end if;
  return jsonb_build_object('hidden', votes >= 3);
end $$;

-- Remove a message: your own, or any message if you are an arcade owner.
create or replace function public.chat_delete(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.chat_messages;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select * into m from chat_messages where id = p_id and not deleted;
  if m.id is null then raise exception 'no such message'; end if;
  if m.author <> uid and not exists (select 1 from arcade_owners where user_id = uid) then raise exception 'that is not your message'; end if;
  update chat_messages set deleted = true, body = '', moment = null where id = p_id;
  delete from chat_reactions where message_id = p_id;
end $$;

-- Arcade owners only: stop a player (by friend code) posting for a while. 0 minutes lifts the mute.
create or replace function public.chat_mute(p_code text, p_minutes int default 60)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid; target_name text; span int := least(greatest(coalesce(p_minutes, 60), 0), 43200);
begin
  if not exists (select 1 from arcade_owners where user_id = auth.uid()) then raise exception 'only the arcade owner can do that'; end if;
  select id, coalesce(display_name, 'Guest ' || friend_code) into target, target_name from profiles where friend_code = upper(trim(p_code));
  if target is null then raise exception 'no player with that friend code'; end if;
  if span = 0 then
    delete from chat_mutes where user_id = target;
  else
    insert into chat_mutes (user_id, until, muted_by) values (target, now() + make_interval(mins => span), auth.uid())
    on conflict (user_id) do update set until = excluded.until, muted_by = excluded.muted_by, created_at = now();
  end if;
  return jsonb_build_object('name', target_name, 'code', upper(trim(p_code)), 'minutes', span);
end $$;

-- Deleting your data removes your chat messages, reactions and reports too.
create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  delete from saves where user_id = auth.uid();
  delete from play_sessions where user_id = auth.uid();
  delete from unlocks where user_id = auth.uid();
  delete from follows where user_id = auth.uid() or friend_id = auth.uid();
  delete from challenges where from_id = auth.uid() or to_id = auth.uid();
  delete from matches where from_id = auth.uid() or to_id = auth.uid();
  delete from chat_reactions where user_id = auth.uid();
  delete from chat_reports where user_id = auth.uid();
  delete from chat_mutes where user_id = auth.uid();
  delete from chat_messages where author = auth.uid();
  delete from profiles where id = auth.uid();
end $$;

do $$
declare f text;
begin
  foreach f in array array['chat_post(text, jsonb)', 'chat_recent(text, bigint, int)', 'chat_react(bigint, text)',
    'chat_report(bigint, text)', 'chat_delete(bigint)', 'chat_mute(text, int)', 'delete_my_data()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
