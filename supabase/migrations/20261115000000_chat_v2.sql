-- DAWG Chat v2: rooms, roles (owner, mods), moderation with an audit log, chat rules, replies,
-- edits, mentions, pins, announcements, slow mode, locked rooms, timeouts and bans, and live
-- updates over Supabase Realtime.
-- Run after 20261114000000_chat.sql. Safe to re-run. Needs no secret key.
-- Every rule is enforced here, in the database: the app only hides buttons a player can't use.
--   owner  = an account in arcade_owners (see 20261024070000_owner.sql)
--   mod    = an account the owner made a mod (chat_set_role)
--   member = everyone else

-- ── Tables ──────────────────────────────────────────────────────────────────────────────────

create table if not exists public.chat_rooms (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{1,23}$'),
  title text not null check (char_length(title) between 1 and 32),
  topic text not null default '' check (char_length(topic) <= 120),
  sort int not null default 100,
  locked boolean not null default false,        -- read-only for members
  slow_seconds int not null default 0 check (slow_seconds between 0 and 3600),
  archived boolean not null default false,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.chat_rooms enable row level security;
revoke all on public.chat_rooms from public, anon, authenticated;
insert into public.chat_rooms (slug, title, topic, sort) values
  ('lobby', 'lobby', 'Hang out with the whole pack.', 10),
  ('bite-night', 'bite-night', 'BITE NIGHT: finishers, matchups and rematches.', 20),
  ('it-learns', 'it-learns', 'IT LEARNS: how far did the House let you get?', 30),
  ('help', 'help', 'Stuck? Ask the pack.', 40),
  ('looking-for-match', 'looking-for-match', 'Find someone to play. Post your game and friend code.', 50)
on conflict (slug) do nothing;

-- Mods. The owner is not stored here: owners come from arcade_owners.
create table if not exists public.chat_roles (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('mod')),
  granted_by uuid references auth.users on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.chat_roles enable row level security;
revoke all on public.chat_roles from public, anon, authenticated;

-- Permanent bans (timeouts stay in chat_mutes from v1).
create table if not exists public.chat_bans (
  user_id uuid primary key references auth.users on delete cascade,
  reason text not null default '' check (char_length(reason) <= 200),
  banned_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.chat_bans enable row level security;
revoke all on public.chat_bans from public, anon, authenticated;
alter table public.chat_mutes add column if not exists reason text not null default '';

-- Every moderation action: who, what, to whom, where, when and why.
create table if not exists public.chat_mod_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users on delete set null,
  action text not null,
  target uuid references auth.users on delete set null,
  message_id bigint,
  room text,
  reason text not null default '',
  detail jsonb
);
create index if not exists chat_mod_log_at on public.chat_mod_log (id desc);
alter table public.chat_mod_log enable row level security;
revoke all on public.chat_mod_log from public, anon, authenticated;

-- The chat rules (one row) and who has agreed to which version.
create table if not exists public.chat_config (
  id int primary key default 1 check (id = 1),
  rules text not null default '',
  rules_version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);
alter table public.chat_config enable row level security;
revoke all on public.chat_config from public, anon, authenticated;
insert into public.chat_config (id, rules) values (1,
  E'1. Be kind. No insults, slurs, threats or bullying.\n2. Keep it clean: no adult content.\n3. No spam, flooding or advertising.\n4. Never share personal details: real names, addresses, phone numbers, passwords.\n5. Mods keep the peace. Their call is final; report anything nasty from a message''s menu.')
on conflict (id) do nothing;

create table if not exists public.chat_rules_ack (
  user_id uuid primary key references auth.users on delete cascade,
  version int not null,
  agreed_at timestamptz not null default now()
);
alter table public.chat_rules_ack enable row level security;
revoke all on public.chat_rules_ack from public, anon, authenticated;

-- New message columns: replies, edits, pins, announcements, mentions, and a touch stamp that
-- changes on every edit, delete or reaction so live clients know to refresh that message.
alter table public.chat_messages add column if not exists reply_to bigint references public.chat_messages (id) on delete set null;
alter table public.chat_messages add column if not exists edited_at timestamptz;
alter table public.chat_messages add column if not exists pinned_at timestamptz;
alter table public.chat_messages add column if not exists pinned_by uuid references auth.users on delete set null;
alter table public.chat_messages add column if not exists kind text not null default 'msg';
alter table public.chat_messages add column if not exists mentions uuid[] not null default '{}';
alter table public.chat_messages add column if not exists touched_at timestamptz not null default now();
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_kind_check') then
    alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('msg', 'announce'));
  end if;
end $$;
create index if not exists chat_messages_pinned on public.chat_messages (room, pinned_at desc) where pinned_at is not null;
create index if not exists chat_messages_mentions on public.chat_messages using gin (mentions);

alter table public.chat_reports add column if not exists resolved_at timestamptz;
alter table public.chat_reports add column if not exists resolved_by uuid references auth.users on delete set null;

-- Live updates. Clients may read only these columns of chat_messages (never text or authors),
-- so the Realtime feed is a "something changed in room X" signal; the text always comes from
-- chat_feed, which applies every rule. Deleted and hidden rows stay visible as signals so open
-- chats can drop them.
revoke select on public.chat_messages from authenticated;
grant select (id, room, created_at, touched_at, deleted, hidden, pinned_at) on public.chat_messages to authenticated;
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select to authenticated using (true);
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- ── Helpers (not callable by players) ──────────────────────────────────────────────────────

create or replace function public.chat_role_of(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when p_user is null then 'member'
              when exists (select 1 from arcade_owners where user_id = p_user) then 'owner'
              when exists (select 1 from chat_roles where user_id = p_user and role = 'mod') then 'mod'
              else 'member' end
$$;

create or replace function public.chat_is_staff(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select chat_role_of(p_user) in ('owner', 'mod')
$$;

create or replace function public.chat_log(p_action text, p_target uuid, p_message bigint, p_room text, p_reason text, p_detail jsonb)
returns void language sql security definer set search_path = public as $$
  insert into chat_mod_log (actor, action, target, message_id, room, reason, detail)
  values (auth.uid(), p_action, p_target, p_message, p_room, left(coalesce(chat_clean(p_reason), ''), 200), p_detail)
$$;

-- Can the caller moderate this player? Nobody moderates the owner; only the owner moderates mods.
create or replace function public.chat_can_moderate(p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select chat_is_staff(auth.uid()) and p_target is distinct from auth.uid()
     and chat_role_of(p_target) <> 'owner'
     and (chat_role_of(p_target) = 'member' or chat_role_of(auth.uid()) = 'owner')
$$;

create or replace function public.chat_target(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from profiles where friend_code = upper(trim(coalesce(p_code, '')))
$$;

create or replace function public.chat_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(display_name, 'Guest ' || friend_code) from profiles where id = p_user
$$;

-- @Name or @Guest_3FA9C210 (spaces in names become _; not inside words or e-mail addresses)
-- → account ids, at most 5.
create or replace function public.chat_mentions_in(p_body text)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct p.id), '{}') from (
    select lower(x.arr[2]) as handle from regexp_matches(coalesce(p_body, ''), '(^|[^A-Za-z0-9_])@([A-Za-z0-9](?:[A-Za-z0-9_.-]{0,22}[A-Za-z0-9])?)', 'g') as x(arr) limit 5
  ) t join profiles p on lower(replace(coalesce(p.display_name, 'Guest ' || p.friend_code), ' ', '_')) = t.handle
$$;

-- ── Posting ─────────────────────────────────────────────────────────────────────────────────

-- Post to a room: text (up to 240 characters), a moment, or both; optionally a reply; owners
-- can post announcements. On top of v1's checks (filter, moment shape, 1 per 3 s, 20 per
-- 5 minutes, no repeats within 2 minutes, public profiles only, timeouts): bans, the rules,
-- locked rooms (staff only) and slow mode (staff are exempt).
create or replace function public.chat_send(p_room text default 'lobby', p_body text default '', p_moment jsonb default null,
                                            p_reply bigint default null, p_announce boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  my_role text := chat_role_of(auth.uid());
  staff boolean := chat_role_of(auth.uid()) in ('owner', 'mod');
  clean text := chat_clean(p_body);
  r public.chat_rooms; shown boolean; muted timestamptz; last_at timestamptz; recent int; mom jsonb; parent bigint; m public.chat_messages;
begin
  if uid is null then raise exception 'sign in first'; end if;
  insert into profiles (id) values (uid) on conflict (id) do nothing;
  if exists (select 1 from chat_bans where user_id = uid) then raise exception 'banned from chat'; end if;
  select is_public into shown from profiles where id = uid;
  if not coalesce(shown, true) then raise exception 'chat is for players shown on public boards'; end if;
  select until into muted from chat_mutes where user_id = uid and until > now();
  if muted is not null then
    raise exception 'chat muted for % more minutes', greatest(1, ceil(extract(epoch from (muted - now())) / 60)::int);
  end if;
  if not staff and not exists (select 1 from chat_rules_ack a join chat_config c on c.id = 1 where a.user_id = uid and a.version >= c.rules_version) then
    raise exception 'agree to the chat rules first';
  end if;
  select * into r from chat_rooms where slug = coalesce(p_room, 'lobby') and not archived;
  if r.slug is null then raise exception 'no such room'; end if;
  if r.locked and not staff then raise exception 'room is locked'; end if;
  if coalesce(p_announce, false) and my_role <> 'owner' then raise exception 'only the arcade owner can do that'; end if;
  if char_length(clean) > 240 then raise exception 'message too long'; end if;
  if clean = '' and p_moment is null then raise exception 'empty message'; end if;
  if not chat_text_ok(clean) then raise exception 'message not allowed'; end if;
  if p_moment is not null then
    if not chat_moment_ok(p_moment) then raise exception 'bad moment'; end if;
    mom := jsonb_build_object('kind', p_moment ->> 'kind', 'game', p_moment ->> 'game',
      'title', chat_clean(p_moment ->> 'title'), 'text', chat_clean(p_moment ->> 'text'), 'data', p_moment -> 'data');
    if not chat_text_ok((mom ->> 'title') || ' ' || (mom ->> 'text')) then raise exception 'message not allowed'; end if;
  end if;
  if p_reply is not null then
    select id into parent from chat_messages where id = p_reply and room = r.slug and not deleted;
    if parent is null then raise exception 'no such message'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('chat:' || uid::text));
  select max(created_at) into last_at from chat_messages where author = uid;
  if last_at is not null and last_at > now() - interval '3 seconds' then raise exception 'slow down'; end if;
  if r.slow_seconds > 0 and not staff then
    select max(created_at) into last_at from chat_messages where author = uid and room = r.slug;
    if last_at is not null and last_at > now() - make_interval(secs => r.slow_seconds) then
      raise exception 'slow mode % seconds', ceil(extract(epoch from (last_at + make_interval(secs => r.slow_seconds) - now())))::int;
    end if;
  end if;
  select count(*) into recent from chat_messages where author = uid and created_at > now() - interval '5 minutes';
  if recent >= 20 then raise exception 'too many messages'; end if;
  if exists (select 1 from chat_messages where author = uid and created_at > now() - interval '2 minutes'
             and not deleted and body = clean and moment is not distinct from mom) then
    raise exception 'duplicate message';
  end if;
  insert into chat_messages (author, body, moment, room, reply_to, kind, mentions)
  values (uid, clean, mom, r.slug, parent, case when coalesce(p_announce, false) then 'announce' else 'msg' end, chat_mentions_in(clean))
  returning * into m;
  if m.kind = 'announce' then perform chat_log('announce', null, m.id, r.slug, '', null); end if;
  return jsonb_build_object('id', m.id, 'created_at', m.created_at);
end $$;

-- v1 clients keep working: their posts go to the lobby through every v2 rule.
create or replace function public.chat_post(p_body text default '', p_moment jsonb default null)
returns jsonb language sql security definer set search_path = public as $$
  select chat_send('lobby', p_body, p_moment, null, false)
$$;

-- Edit your own message within 5 minutes of posting it.
create or replace function public.chat_edit(p_id bigint, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); clean text := chat_clean(p_body); m public.chat_messages; muted timestamptz;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if exists (select 1 from chat_bans where user_id = uid) then raise exception 'banned from chat'; end if;
  select until into muted from chat_mutes where user_id = uid and until > now();
  if muted is not null then
    raise exception 'chat muted for % more minutes', greatest(1, ceil(extract(epoch from (muted - now())) / 60)::int);
  end if;
  select * into m from chat_messages where id = p_id and not deleted for update;
  if m.id is null then raise exception 'no such message'; end if;
  if m.author <> uid then raise exception 'that is not your message'; end if;
  if m.created_at < now() - interval '5 minutes' then raise exception 'too late to edit'; end if;
  if char_length(clean) > 240 then raise exception 'message too long'; end if;
  if clean = '' and m.moment is null then raise exception 'empty message'; end if;
  if not chat_text_ok(clean) then raise exception 'message not allowed'; end if;
  update chat_messages set body = clean, edited_at = now(), touched_at = now(), mentions = chat_mentions_in(clean) where id = p_id;
  return jsonb_build_object('id', p_id, 'edited', true);
end $$;

-- ── Reading ─────────────────────────────────────────────────────────────────────────────────

-- Who am I in chat: role, rules, and any timeout or ban.
create or replace function public.chat_me()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.chat_config;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select * into c from chat_config where id = 1;
  return jsonb_build_object(
    'role', chat_role_of(uid),
    'code', (select friend_code from profiles where id = uid),
    'rules', coalesce(c.rules, ''), 'rules_version', coalesce(c.rules_version, 1),
    'agreed', exists (select 1 from chat_rules_ack where user_id = uid and version >= coalesce(c.rules_version, 1)),
    'muted_until', (select until from chat_mutes where user_id = uid and until > now()),
    'banned', exists (select 1 from chat_bans where user_id = uid),
    'ban_reason', (select reason from chat_bans where user_id = uid));
end $$;

create or replace function public.chat_agree(p_version int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select rules_version into v from chat_config where id = 1;
  if p_version is distinct from v then raise exception 'the rules changed, read them again'; end if;
  insert into chat_rules_ack (user_id, version) values (auth.uid(), v)
  on conflict (user_id) do update set version = excluded.version, agreed_at = now();
  return chat_me();
end $$;

-- Rooms with their newest message id (for unread counts). Staff also see archived rooms.
create or replace function public.chat_rooms()
returns table (slug text, title text, topic text, sort int, locked boolean, slow_seconds int, archived boolean, last_id bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.slug, r.title, r.topic, r.sort, r.locked, r.slow_seconds, r.archived,
         (select max(m.id) from chat_messages m where m.room = r.slug and not m.deleted and not m.hidden),
         (select max(m.created_at) from chat_messages m where m.room = r.slug and not m.deleted and not m.hidden)
  from chat_rooms r
  where auth.uid() is not null and (not r.archived or chat_is_staff(auth.uid()))
  order by r.sort, r.slug
$$;

-- A room's messages, newest first: before an id (older pages), after an id (catching up), or
-- only the pinned ones. Same visibility rules as v1, plus replies, edits, pins, roles, mentions.
create or replace function public.chat_feed(p_room text default 'lobby', p_before bigint default null, p_after bigint default null,
                                            p_limit int default 50, p_pinned boolean default false)
returns table (id bigint, room text, created_at timestamptz, body text, moment jsonb, player text, friend_code text, avatar jsonb,
               level int, role text, mine boolean, reactions jsonb, my_reaction text, reply_id bigint, reply_player text,
               reply_body text, edited boolean, pinned boolean, kind text, mentions_me boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.room, m.created_at, m.body, m.moment, coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar,
         arcade_level((select coalesce(sum(s.xp), 0) from play_sessions s where s.user_id = m.author)),
         chat_role_of(m.author),
         m.author = auth.uid(),
         coalesce((select jsonb_object_agg(r.emoji, r.n) from (select c.emoji, count(*) as n from chat_reactions c where c.message_id = m.id group by c.emoji) r), '{}'::jsonb),
         (select c.emoji from chat_reactions c where c.message_id = m.id and c.user_id = auth.uid()),
         m.reply_to,
         (select coalesce(q.display_name, 'Guest ' || q.friend_code) from chat_messages o join profiles q on q.id = o.author where o.id = m.reply_to and not o.deleted and not o.hidden),
         (select left(case when o.body <> '' then o.body else coalesce(o.moment ->> 'title', '') end, 90) from chat_messages o where o.id = m.reply_to and not o.deleted and not o.hidden),
         m.edited_at is not null, m.pinned_at is not null, m.kind, auth.uid() = any (m.mentions)
  from chat_messages m join profiles p on p.id = m.author
  where auth.uid() is not null
    and m.room = coalesce(p_room, 'lobby')
    and not m.deleted
    and (not m.hidden or m.author = auth.uid())
    and (p.is_public or m.author = auth.uid())
    and (p_before is null or m.id < p_before)
    and (p_after is null or m.id > p_after)
    and (not coalesce(p_pinned, false) or m.pinned_at is not null)
    and not exists (select 1 from chat_reports x where x.message_id = m.id and x.user_id = auth.uid())
  order by case when coalesce(p_pinned, false) then m.pinned_at end desc nulls last, m.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

-- Recent messages that mention you, for the Chat badge.
create or replace function public.chat_mentions(p_after bigint default 0)
returns table (id bigint, room text, created_at timestamptz, player text, body text)
language sql stable security definer set search_path = public as $$
  select m.id, m.room, m.created_at, coalesce(p.display_name, 'Guest ' || p.friend_code), left(m.body, 120)
  from chat_messages m join profiles p on p.id = m.author
  where auth.uid() is not null and auth.uid() = any (m.mentions) and m.id > coalesce(p_after, 0)
    and not m.deleted and not m.hidden and m.created_at > now() - interval '7 days' and m.author <> auth.uid()
  order by m.id desc limit 20
$$;

-- The owner and mods, for badges and the staff list. Public names only.
create or replace function public.chat_staff()
returns table (player text, friend_code text, avatar jsonb, role text, since timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(p.display_name, 'Guest ' || p.friend_code), p.friend_code, p.avatar, s.role, s.since
  from (select user_id, 'owner'::text as role, added_at as since from arcade_owners
        union all select user_id, role, granted_at from chat_roles where user_id not in (select user_id from arcade_owners)) s
  join profiles p on p.id = s.user_id
  where auth.uid() is not null
  order by case s.role when 'owner' then 0 else 1 end, 1
$$;

-- ── Reactions, reports and deletes (v1 functions, now with bans, mods and live signals) ─────

create or replace function public.chat_react(p_id bigint, p_emoji text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); had text;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if exists (select 1 from chat_bans where user_id = uid) then raise exception 'banned from chat'; end if;
  if p_emoji is not null and p_emoji not in ('🔥', '😂', '👏', '💀', '🐶', '💜') then raise exception 'unknown reaction'; end if;
  if not exists (select 1 from chat_messages where id = p_id and not deleted and not hidden) then raise exception 'no such message'; end if;
  select emoji into had from chat_reactions where message_id = p_id and user_id = uid;
  if p_emoji is null or had = p_emoji then
    delete from chat_reactions where message_id = p_id and user_id = uid;
  else
    insert into chat_reactions (message_id, user_id, emoji) values (p_id, uid, p_emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
  update chat_messages set touched_at = now() where id = p_id;
  return jsonb_build_object(
    'reactions', coalesce((select jsonb_object_agg(r.emoji, r.n) from (select emoji, count(*) as n from chat_reactions where message_id = p_id group by emoji) r), '{}'::jsonb),
    'mine', (select emoji from chat_reactions where message_id = p_id and user_id = uid));
end $$;

-- Report a message. Unresolved reports from 3 players with at least one run hide it for
-- everyone until a mod dismisses or removes it.
create or replace function public.chat_report(p_id bigint, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.chat_messages; today int; votes int;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if exists (select 1 from chat_bans where user_id = uid) then raise exception 'banned from chat'; end if;
  select * into m from chat_messages where id = p_id and not deleted;
  if m.id is null then raise exception 'no such message'; end if;
  if m.author = uid then raise exception 'that is your own message'; end if;
  select count(*) into today from chat_reports where user_id = uid and created_at > now() - interval '1 day';
  if today >= 30 then raise exception 'too many reports today'; end if;
  insert into chat_reports (message_id, user_id, reason) values (p_id, uid, left(chat_clean(p_reason), 200))
  on conflict (message_id, user_id) do update set reason = excluded.reason, created_at = now(), resolved_at = null, resolved_by = null;
  select count(*) into votes from chat_reports r
    where r.message_id = p_id and r.resolved_at is null and exists (select 1 from play_sessions s where s.user_id = r.user_id);
  if votes >= 3 and not m.hidden then update chat_messages set hidden = true, touched_at = now() where id = p_id; end if;
  return jsonb_build_object('hidden', votes >= 3);
end $$;

-- Remove a message: your own, a member's if you are a mod, anyone's if you are the owner.
-- Removing someone else's message goes in the moderation log.
create or replace function public.chat_delete(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.chat_messages;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select * into m from chat_messages where id = p_id and not deleted;
  if m.id is null then raise exception 'no such message'; end if;
  if m.author <> uid then
    if not (chat_can_moderate(m.author) or chat_role_of(uid) = 'owner') then raise exception 'that is not your message'; end if;
    perform chat_log('delete', m.author, m.id, m.room, '', jsonb_build_object('body', left(m.body, 240), 'moment', m.moment ->> 'title'));
    update chat_reports set resolved_at = now(), resolved_by = uid where message_id = p_id and resolved_at is null;
  end if;
  update chat_messages set deleted = true, body = '', moment = null, pinned_at = null, touched_at = now() where id = p_id;
  delete from chat_reactions where message_id = p_id;
end $$;

-- ── Staff tools ─────────────────────────────────────────────────────────────────────────────

-- Time a player out. Mods: 5, 60 or 1440 minutes. The owner: up to 30 days. 0 lifts it.
create or replace function public.chat_timeout(p_code text, p_minutes int, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid := chat_target(p_code); span int := coalesce(p_minutes, 0);
begin
  if not chat_is_staff(auth.uid()) then raise exception 'only staff can do that'; end if;
  if target is null then raise exception 'no player with that friend code'; end if;
  if not chat_can_moderate(target) then raise exception 'you can not moderate that player'; end if;
  if chat_role_of(auth.uid()) = 'mod' and span not in (0, 5, 60, 1440) then raise exception 'mods can time out for 5 minutes, 1 hour or 1 day'; end if;
  span := least(greatest(span, 0), 43200);
  if span = 0 then
    delete from chat_mutes where user_id = target;
  else
    insert into chat_mutes (user_id, until, muted_by, reason) values (target, now() + make_interval(mins => span), auth.uid(), left(chat_clean(p_reason), 200))
    on conflict (user_id) do update set until = excluded.until, muted_by = excluded.muted_by, reason = excluded.reason, created_at = now();
  end if;
  perform chat_log(case when span = 0 then 'untimeout' else 'timeout' end, target, null, null, p_reason, jsonb_build_object('minutes', span));
  return jsonb_build_object('name', chat_name(target), 'code', upper(trim(p_code)), 'minutes', span);
end $$;

-- v1's owner mute, now the same as a timeout (and logged).
create or replace function public.chat_mute(p_code text, p_minutes int default 60)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from arcade_owners where user_id = auth.uid()) then raise exception 'only the arcade owner can do that'; end if;
  return chat_timeout(p_code, least(greatest(coalesce(p_minutes, 60), 0), 43200), '');
end $$;

create or replace function public.chat_ban(p_code text, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid := chat_target(p_code);
begin
  if chat_role_of(auth.uid()) <> 'owner' then raise exception 'only the arcade owner can do that'; end if;
  if target is null then raise exception 'no player with that friend code'; end if;
  if not chat_can_moderate(target) then raise exception 'you can not moderate that player'; end if;
  insert into chat_bans (user_id, reason, banned_by) values (target, left(chat_clean(p_reason), 200), auth.uid())
  on conflict (user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  delete from chat_roles where user_id = target;
  perform chat_log('ban', target, null, null, p_reason, null);
  return jsonb_build_object('name', chat_name(target), 'code', upper(trim(p_code)));
end $$;

create or replace function public.chat_unban(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid := chat_target(p_code);
begin
  if chat_role_of(auth.uid()) <> 'owner' then raise exception 'only the arcade owner can do that'; end if;
  if target is null then raise exception 'no player with that friend code'; end if;
  delete from chat_bans where user_id = target;
  perform chat_log('unban', target, null, null, '', null);
  return jsonb_build_object('name', chat_name(target), 'code', upper(trim(p_code)));
end $$;

-- Make a player a mod, or take it back ('member'). Owner only; owners can't be changed here.
create or replace function public.chat_set_role(p_code text, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid := chat_target(p_code);
begin
  if chat_role_of(auth.uid()) <> 'owner' then raise exception 'only the arcade owner can do that'; end if;
  if target is null then raise exception 'no player with that friend code'; end if;
  if p_role not in ('mod', 'member') then raise exception 'unknown role'; end if;
  if chat_role_of(target) = 'owner' then raise exception 'you can not moderate that player'; end if;
  if p_role = 'mod' then
    if exists (select 1 from chat_bans where user_id = target) then raise exception 'banned from chat'; end if;
    insert into chat_roles (user_id, role, granted_by) values (target, 'mod', auth.uid()) on conflict (user_id) do nothing;
  else
    delete from chat_roles where user_id = target;
  end if;
  perform chat_log(case when p_role = 'mod' then 'make_mod' else 'remove_mod' end, target, null, null, '', null);
  return jsonb_build_object('name', chat_name(target), 'code', upper(trim(p_code)), 'role', p_role);
end $$;

-- Timed-out and banned players. Staff only.
create or replace function public.chat_sanctions()
returns table (kind text, player text, friend_code text, until timestamptz, reason text, by_player text, since timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not chat_is_staff(auth.uid()) then raise exception 'only staff can do that'; end if;
  return query
    select 'ban'::text, chat_name(b.user_id), p.friend_code, null::timestamptz, b.reason, chat_name(b.banned_by), b.created_at
    from chat_bans b join profiles p on p.id = b.user_id
    union all
    select 'timeout'::text, chat_name(t.user_id), p.friend_code, t.until, t.reason, chat_name(t.muted_by), t.created_at
    from chat_mutes t join profiles p on p.id = t.user_id where t.until > now()
    order by 7 desc;
end $$;

-- Reported messages waiting for a decision. Staff only.
create or replace function public.chat_report_queue()
returns table (message_id bigint, room text, created_at timestamptz, body text, moment_title text, player text, friend_code text,
               role text, reporters int, reasons text[], latest timestamptz, hidden boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not chat_is_staff(auth.uid()) then raise exception 'only staff can do that'; end if;
  return query
    select m.id, m.room, m.created_at, m.body, m.moment ->> 'title', chat_name(m.author), p.friend_code, chat_role_of(m.author),
           count(*)::int, (array_agg(r.reason order by r.created_at desc) filter (where r.reason <> ''))[1:5], max(r.created_at), m.hidden
    from chat_reports r join chat_messages m on m.id = r.message_id join profiles p on p.id = m.author
    where r.resolved_at is null and not m.deleted
    group by m.id, p.friend_code
    order by max(r.created_at) desc
    limit 100;
end $$;

-- Decide a report: 'dismiss' (the message stays, and comes back if it was hidden) or 'delete'.
create or replace function public.chat_resolve_report(p_id bigint, p_action text, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare m public.chat_messages;
begin
  if not chat_is_staff(auth.uid()) then raise exception 'only staff can do that'; end if;
  if p_action not in ('dismiss', 'delete') then raise exception 'unknown action'; end if;
  select * into m from chat_messages where id = p_id;
  if m.id is null then raise exception 'no such message'; end if;
  if p_action = 'delete' and not m.deleted then
    perform chat_delete(p_id);
  elsif p_action = 'dismiss' then
    update chat_messages set hidden = false, touched_at = now() where id = p_id;
  end if;
  update chat_reports set resolved_at = now(), resolved_by = auth.uid() where message_id = p_id and resolved_at is null;
  perform chat_log('report_' || p_action, m.author, p_id, m.room, p_reason, null);
end $$;

-- Pin or unpin a message in its room. Staff only.
create or replace function public.chat_pin(p_id bigint, p_on boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare m public.chat_messages;
begin
  if not chat_is_staff(auth.uid()) then raise exception 'only staff can do that'; end if;
  select * into m from chat_messages where id = p_id and not deleted and not hidden;
  if m.id is null then raise exception 'no such message'; end if;
  if coalesce(p_on, true) and (select count(*) from chat_messages where room = m.room and pinned_at is not null and not deleted) >= 10 then
    raise exception 'a room holds 10 pins at most';
  end if;
  update chat_messages set pinned_at = case when coalesce(p_on, true) then now() end,
                           pinned_by = case when coalesce(p_on, true) then auth.uid() end, touched_at = now() where id = p_id;
  perform chat_log(case when coalesce(p_on, true) then 'pin' else 'unpin' end, m.author, p_id, m.room, '', null);
end $$;

-- Room settings. Mods: slow mode only. The owner: title, topic, lock, archive and slow mode.
-- A null argument leaves that setting as it is.
create or replace function public.chat_room_settings(p_room text, p_slow int default null, p_locked boolean default null,
                                                     p_title text default null, p_topic text default null, p_archived boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare owner boolean := chat_role_of(auth.uid()) = 'owner'; r public.chat_rooms;
begin
  if not chat_is_staff(auth.uid()) then raise exception 'only staff can do that'; end if;
  if not owner and (p_locked is not null or p_title is not null or p_topic is not null or p_archived is not null) then
    raise exception 'only the arcade owner can do that';
  end if;
  select * into r from chat_rooms where slug = p_room;
  if r.slug is null then raise exception 'no such room'; end if;
  if p_slow is not null and (p_slow < 0 or p_slow > 3600) then raise exception 'slow mode is 0 to 3600 seconds'; end if;
  if p_title is not null and chat_clean(p_title) !~ '^[a-z0-9][a-z0-9-]{1,31}$' then raise exception 'room names are 2 to 32 lowercase letters, numbers and -'; end if;
  if p_topic is not null and (char_length(chat_clean(p_topic)) > 120 or not chat_text_ok(p_topic)) then raise exception 'message not allowed'; end if;
  if p_archived and p_room = 'lobby' then raise exception 'the lobby stays open'; end if;
  update chat_rooms set slow_seconds = coalesce(p_slow, slow_seconds), locked = coalesce(p_locked, locked),
    title = case when p_title is null then title else chat_clean(p_title) end,
    topic = case when p_topic is null then topic else chat_clean(p_topic) end, archived = coalesce(p_archived, archived)
  where slug = p_room returning * into r;
  perform chat_log('room', null, null, p_room, '', jsonb_strip_nulls(jsonb_build_object('slow', p_slow, 'locked', p_locked, 'title', p_title, 'topic', p_topic, 'archived', p_archived)));
  return to_jsonb(r) - 'created_by';
end $$;

create or replace function public.chat_room_create(p_slug text, p_topic text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if chat_role_of(auth.uid()) <> 'owner' then raise exception 'only the arcade owner can do that'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,23}$' then raise exception 'room names are 2 to 24 lowercase letters, numbers and -'; end if;
  if not chat_text_ok(v_slug || ' ' || coalesce(p_topic, '')) or char_length(chat_clean(p_topic)) > 120 then raise exception 'message not allowed'; end if;
  if (select count(*) from chat_rooms where not archived) >= 20 then raise exception 'twenty rooms at most'; end if;
  insert into chat_rooms (slug, title, topic, sort, created_by) values (v_slug, v_slug, chat_clean(p_topic), 100 + (select count(*)::int from chat_rooms), auth.uid())
  on conflict on constraint chat_rooms_pkey do update set archived = false;
  perform chat_log('room_create', null, null, v_slug, '', jsonb_build_object('topic', chat_clean(p_topic)));
  return jsonb_build_object('slug', v_slug);
end $$;

-- The chat rules. Changing them asks every member to agree again.
create or replace function public.chat_set_rules(p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text := btrim(regexp_replace(coalesce(p_text, ''), '[\x01-\x08\x0B-\x1F\x7F]', '', 'g'));
begin
  if chat_role_of(auth.uid()) <> 'owner' then raise exception 'only the arcade owner can do that'; end if;
  if char_length(t) not between 10 and 2000 then raise exception 'rules are 10 to 2000 characters'; end if;
  update chat_config set rules = t, rules_version = rules_version + 1, updated_at = now(), updated_by = auth.uid() where id = 1;
  perform chat_log('rules', null, null, null, '', jsonb_build_object('version', (select rules_version from chat_config where id = 1)));
  return chat_me();
end $$;

-- The audit log, newest first. Staff only.
create or replace function public.chat_mod_log(p_before bigint default null, p_limit int default 50)
returns table (id bigint, at timestamptz, actor text, actor_code text, action text, target text, target_code text,
               message_id bigint, room text, reason text, detail jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not chat_is_staff(auth.uid()) then raise exception 'only staff can do that'; end if;
  return query
    select l.id, l.at, chat_name(l.actor), (select pa.friend_code from profiles pa where pa.id = l.actor), l.action,
           chat_name(l.target), (select pt.friend_code from profiles pt where pt.id = l.target), l.message_id, l.room, l.reason, l.detail
    from chat_mod_log l
    where p_before is null or l.id < p_before
    order by l.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;

-- ── Your data ───────────────────────────────────────────────────────────────────────────────

-- Deleting your data removes your chat role, ban, rules agreement and your name from the
-- moderation log (the log entry stays, without you), on top of everything before.
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
  delete from chat_bans where user_id = auth.uid();
  delete from chat_roles where user_id = auth.uid();
  delete from chat_rules_ack where user_id = auth.uid();
  update chat_mod_log set actor = null where actor = auth.uid();
  update chat_mod_log set target = null where target = auth.uid();
  update chat_messages set pinned_by = null where pinned_by = auth.uid();
  update chat_messages set mentions = array_remove(mentions, auth.uid()) where auth.uid() = any (mentions);
  update chat_rooms set created_by = null where created_by = auth.uid();
  delete from chat_messages where author = auth.uid();
  delete from profiles where id = auth.uid();
end $$;

-- ── Who can call what ───────────────────────────────────────────────────────────────────────

do $$
declare f text;
begin
  -- Helpers: nobody calls these directly.
  foreach f in array array['chat_role_of(uuid)', 'chat_is_staff(uuid)', 'chat_log(text, uuid, bigint, text, text, jsonb)',
    'chat_can_moderate(uuid)', 'chat_target(text)', 'chat_name(uuid)', 'chat_mentions_in(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- Player and staff functions: signed-in players only; each one checks the caller's role itself.
  foreach f in array array['chat_send(text, text, jsonb, bigint, boolean)', 'chat_post(text, jsonb)', 'chat_edit(bigint, text)',
    'chat_me()', 'chat_agree(int)', 'chat_rooms()', 'chat_feed(text, bigint, bigint, int, boolean)', 'chat_mentions(bigint)',
    'chat_staff()', 'chat_react(bigint, text)', 'chat_report(bigint, text)', 'chat_delete(bigint)',
    'chat_timeout(text, int, text)', 'chat_mute(text, int)', 'chat_ban(text, text)', 'chat_unban(text)', 'chat_set_role(text, text)',
    'chat_sanctions()', 'chat_report_queue()', 'chat_resolve_report(bigint, text, text)', 'chat_pin(bigint, boolean)',
    'chat_room_settings(text, int, boolean, text, text, boolean)', 'chat_room_create(text, text)', 'chat_set_rules(text)',
    'chat_mod_log(bigint, int)', 'delete_my_data()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
