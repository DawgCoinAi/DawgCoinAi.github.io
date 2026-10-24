# Cloud saves: Supabase setup

The arcade works fully offline. With Supabase connected it also keeps each player's progress in the cloud, so it survives cleared browsers and follows them to other devices. It also records finished runs for play walls. Players start as guests, and can add an email later with a one-time link (no password).

Project: `https://zbdvbplhwsqmsplsdexe.supabase.co`. The publishable key is in `dist/cloud-config.js`, and it is meant to be public.

## One-time setup (dashboard)

1. **Create the tables and rules.** Open **SQL Editor → New query**. Paste all of `supabase/migrations/20261024000000_arcade.sql` and run it. It is safe to run again later.
   Then do the same with `supabase/migrations/20261024010000_social.sql` (player names, friends, leaderboards, global stats). Run the files in date order; both are safe to re-run.
2. **Allow guests.** Under **Authentication → Sign In / Providers**, turn on **Allow anonymous sign-ins**.
3. **Allow email links.** Under the same page, make sure **Email** is enabled. Without custom SMTP, Supabase only sends a few emails per hour; add SMTP before launch.
4. **Tell Supabase where the game lives.** Under **Authentication → URL Configuration**:
   - Set **Site URL** to `https://dawgcoinai.github.io/`.
   - Add these **Redirect URLs**:
     - `https://dawgcoinai.github.io/**`
     - `http://localhost:8787/**` (for local play)
5. **Recommended before real traffic:** turn on **Authentication → Attack Protection → CAPTCHA** (Cloudflare Turnstile). Anyone can create a guest account, and CAPTCHA stops bots from mass-creating them. Turning it on also needs a small client change; ask for it when you enable it.

## Keep secrets out of the code

- Only the **publishable** key belongs in the app.
- The **secret** key (`sb_secret_…`) and the **database password** bypass every security rule. Never put them in `dist/`, in commits or in chat. A test fails if a secret key ever appears in `dist/`.
- If either one was ever shared, rotate it:
  - Secret key: **Project Settings → API Keys**.
  - Database password: **Project Settings → Database**.

## What is stored

| Table | Contents | Who can access it |
| --- | --- | --- |
| `saves` | One row per save section (records, characters, settings, progress, arcade XP) | Owner reads and writes |
| `play_sessions` | One row per finished run: game, score, active seconds, local day | Owner reads; writes go only through `record_session()`, which caps time and XP and rejects overlapping runs |
| `unlocks` | Games the server has verified as unlocked | Owner reads; written only by `claim_unlocks()` |
| `profiles` | Public player name, DAWG avatar, friend code, visibility | Owner writes through `set_profile()`; others see only public cards and boards through server functions |
| `follows` | Who each player has added as a friend | Owner reads; written through `follow_code()` / `unfollow_code()` |

**Encryption and access:**
- Data travels over HTTPS and is encrypted at rest by Supabase.
- Row Level Security limits every request to the signed-in player's own rows.
- **Delete my cloud data** in the Account panel calls `delete_my_data()`, which removes every row belonging to that player.

**Limits to know:**
- Progress is computed in the browser and mirrored to the server, so a player can still edit their own save to open games early. That only affects that player.
- Leaderboard scores are reported by the browser. The server keeps scores that are impossible for the run's length off the boards (`score_cap()`), but a determined cheater could still post a plausible fake score. Before offering prizes, add server-side run verification, such as replaying seeded inputs.
