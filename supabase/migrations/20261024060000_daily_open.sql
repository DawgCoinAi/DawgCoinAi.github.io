-- Daily Run opens on day one, so every player has a reason to come back tomorrow.
-- Run after 20261024050000_social_inbox.sql. Safe to re-run.

-- Unlock ladder. Keep in step with dist/unlocks.js (a test compares the two).
create or replace function public.arcade_ladder()
returns table (game text, min_level int, min_minutes int, min_streak int, challenge text)
language sql immutable as $$
  values
    ('snake', 3, 20, 2, null::text),
    ('rush', 4, 30, null::int, null::text),
    ('cross', 5, 45, 3, null::text),
    ('trade', 6, 60, null::int, 'dash100'),
    ('turbo', 7, 90, 4, null::text),
    ('pinball', 8, 100, 3, null::text),
    ('kart', 9, 110, 3, null::text),
    ('story', 10, 120, 5, null::text)
$$;
