-- Turbo Pup joins the play walls and leaderboards, and player names get a fairer filter.
-- Run after 20261024010000_social.sql. Safe to re-run.

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
    ('turbo', 7, 90, 4, null::text),
    ('story', 10, 120, 5, null::text)
$$;

create or replace function public.score_cap(p_game text, p_seconds int)
returns bigint language sql immutable as $$
  select case p_game
    when 'runner' then 120 * p_seconds + 1000
    when 'turbo' then 420 * p_seconds + 2000
    when 'flappy' then 25 * p_seconds + 200
    when 'snake' then 80 * p_seconds + 1200
    when 'cross' then 60 * p_seconds + 500
    when 'story' then 5000
    when 'trade' then 100000000
    else 600 * p_seconds + 5000
  end
$$;

-- Player names: 3–16 letters, digits, spaces, _ . -. Letter swaps (0→o, 1→i, 3→e, 4→a, 5→s,
-- 7→t, @→a, $→s) are undone first. Unambiguous slurs are refused anywhere in the name; words
-- that hide inside ordinary ones (Scunthorpe, Dickens, cocktail, shiitake, grape) are refused
-- only as a whole word, at the end of a word, or with an insulting suffix.
create or replace function public.name_ok(p_name text)
returns boolean language sql immutable as $$
  select p_name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{1,14}[A-Za-z0-9]$'
     and not (t ~ '(fuck|nigg|bitch|whore|retard|hitler|nazi|pussy|cunt([^h]|$)|\mkys\M)'
           or t ~ '(dick|cock|shit|slut|porn)(s|head|face|hole|bag|lord|wad|ty|y|z|er|ers)?\M'
           or t ~ '\m(rape|raper|rapist|fag|fags|faggot)\M')
  from (select translate(lower(p_name), '013457@$_.-', 'oieastas   ') as t) n
$$;
