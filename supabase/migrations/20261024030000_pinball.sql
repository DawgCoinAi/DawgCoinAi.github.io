-- Neon Pinball joins the play walls and leaderboards.
-- Run after 20261024020000_turbo.sql. Safe to re-run.

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
    ('pinball', 8, 100, 3, null::text),
    ('story', 10, 120, 5, null::text)
$$;

-- Highest believable score for a run of p_seconds. Pinball scores in bursts (multiball pays
-- 5,000 times the lane multiplier), so its cap is roomier than the other games'.
create or replace function public.score_cap(p_game text, p_seconds int)
returns bigint language sql immutable as $$
  select case p_game
    when 'runner' then 120 * p_seconds + 1000
    when 'turbo' then 420 * p_seconds + 2000
    when 'pinball' then 3000 * p_seconds + 30000
    when 'flappy' then 25 * p_seconds + 200
    when 'snake' then 80 * p_seconds + 1200
    when 'cross' then 60 * p_seconds + 500
    when 'story' then 5000
    when 'trade' then 100000000
    else 600 * p_seconds + 5000
  end
$$;
