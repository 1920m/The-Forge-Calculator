# Running the API: setup, keys, testing and troubleshooting

This is for the site owner. No coding needed for most of it: the database part is one SQL file, and keys are made in the dashboard.

## 1. Turn the API on in Supabase

The API's tables and functions come from one file: `supabase/migrations/20261104100000_public_api.sql`. Until it has been run, both endpoints answer `503 SERVICE_UNAVAILABLE`. The rest of the website works either way.

1. Open the Supabase project, then **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261104100000_public_api.sql` on GitHub, press **Raw**, select everything and copy it.
3. Paste it into the editor and press **Run**. It should finish with "Success. No rows returned".
4. Check it worked by running this in a new query:

   ```sql
   select (select count(*) from private.api_admins) as admins,
          (select count(*) from private.api_settings) as settings,
          (select count(*) from pg_proc where proname like 'api_%') as functions;
   ```

   Expected: `admins = 1`, `settings = 1`, `functions = 11`.

Run the file **once**. A second run stops at the first `create table` with "already exists" and changes nothing.

What it creates, all in the hidden `private` schema: the admin list, one settings row, the keys (hashes only), the per-minute counters, the wrong-key counters and the usage log. The only rows it ever deletes are its own old counters and log rows (see "Clean-up" in [README.md](README.md#security-in-one-list)). It doesn't touch users, profiles, saved forges or any other table.

Nothing needs adding to Vercel: the API uses the same `NEXT_PUBLIC_SUPABASE_URL` and anon key the site already has. The anon key can only call `api_authorize` and `api_finish`, which check everything themselves.

## 2. The admin account

The migration adds one admin: the account with ID `c13e43d5-0051-47c7-84f3-db21d997f90f` (1920m, signed in with Discord). Admin rights go with that ID, never with the display name, so renaming another account to "1920m" gives it nothing.

To see the ID of an account: Supabase → **Authentication** → **Users** → the user's row → **User UID**.

To add a second admin later (for example a new account of yours), run:

```sql
insert into private.api_admins (user_id) values ('the-user-uid-here');
```

To remove one:

```sql
delete from private.api_admins where user_id = 'the-user-uid-here';
```

Only the SQL editor (the project owner) can change this list. No website page or API call can.

## 3. The dashboard

Go to [/developers/dashboard](https://the-forge-calculator.vercel.app/developers/dashboard) and sign in with the admin account. Signed out, it asks you to sign in; any other account sees "Your account doesn't have access to the API dashboard", and the database refuses every admin function for them even if they call it directly.

The dashboard has:

- **Overview**: requests in the last 24 hours and 30 days, active keys, failed and rate-limited requests over 7 days, response times, and a 14-day chart.
- **API keys**: every key with its name, its first characters, permissions, limits, when it was last used and its status (active, expiring, revoked or expired), with **Rotate** and **Revoke** buttons.
- **Access**: the **Catalogue without a key** switch (off during the private beta) and its limit per IP address.
- **Recent requests**: the last 50 calls with key, endpoint, status, time taken and error code.

## 4. Make a key for a bot

1. On the dashboard press **New key**.
2. **Name**: who or what uses it, for example `Discord bot (Alex)`.
3. **Permissions**: tick both `catalogue:read` and `calculator:execute` for a `/forge-calc` bot.
4. **Limits**: leave 60 and 120 a minute unless the bot is in many busy servers.
5. **Expires**: optional. Leave empty for a key that works until you revoke it.
6. Press **Create key**. The key (`fc_live_…`) appears **once**. Press **Copy** and send it to the bot owner privately (a Discord DM, not a server channel). Once you press **I've saved it, hide the key** it can't be shown again; if it's lost, rotate the key.

The bot owner puts it in their bot's environment as `FORGE_API_KEY`. It must never go in public code.

## 5. Testing

### On the live site (or a Vercel preview)

With a key in `KEY`:

```bash
KEY=fc_live_...
BASE=https://the-forge-calculator.vercel.app/api/v1

# 401: no key
curl -i "$BASE/catalogue?type=ores&ids=bismuth"

# 200 with the Bismuth entry, an ETag and X-RateLimit-* headers
curl -i -H "Authorization: Bearer $KEY" "$BASE/catalogue?type=ores&ids=bismuth"

# 200: Dark Knight's Gauntlets, 393.33 DMG, estimated DPS 2851.87
curl -s -X POST "$BASE/calculate" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"type":"forge","kind":"weapon","item":"dark-knights-gauntlets","ores":[{"id":"galaxite","count":5},{"id":"kyubite","count":5},{"id":"fierce-jade","count":5},{"id":"bismuth","count":1}]}'
```

Then check the dashboard: the requests show up under **Recent requests** within a few seconds, and the key's "last used" changes.

A Vercel preview deployment uses the same Supabase project, so the same key works there; use the preview's address in `BASE`.

### On your computer

```bash
npm install
npm test                    # unit tests, including the API's
npm run lint && npx tsc --noEmit
npm run build && npm start  # then open http://localhost:3000/developers
```

The database tests need a local Postgres 16 (`PGHOST`, `PGPORT`, `PGUSER` set):

```bash
bash supabase/tests/run-api-tests.sh
```

It builds a throwaway database with a stand-in for Supabase, runs the migration, the security tests (`API SECURITY TESTS PASSED`) and the race test: 200 requests from 20 connections at a 100-a-minute key must give exactly 100 allowed and 100 refused (`API CONCURRENCY TEST PASSED`).

## 6. Monitoring

Look at the dashboard now and then:

- **A spike in rate-limited requests** for one key: the bot is calling too often. Usually it isn't caching the catalogue. Ask the owner, or raise that key's limit.
- **Many 401s**: someone is trying old or wrong keys. Addresses that send 20 wrong keys in 10 minutes are locked out automatically for 10 minutes.
- **5xx errors**: check Vercel → the project → **Logs**, filtered to `/api/v1`. The `requestId` in the bot's error message matches the `X-Request-Id` in the logs.
- **A key never used**: consider revoking it.

## 7. Rotating and revoking

**Rotate** when a key may have leaked, or as routine. Press **Rotate** on the key, pick how long the old key keeps working (0 hours, 1 hour, 24 hours, 3 days or 7 days), confirm, and copy the new key. Send it to the bot owner; their bot works with either key during the overlap, so there's no downtime. After the overlap the old key answers `401 API_KEY_EXPIRED`.

**Revoke** to stop a key straight away (a leak you can't wait on, or a bot that's gone). It takes effect on the next request: `401 API_KEY_REVOKED`. Revoking can't be undone; make a new key if needed.

**Anonymous catalogue**: when the beta is over, turn on **Catalogue without a key** under **Access**. Calculations always need a key.

## 8. Troubleshooting

| What you see | Why | What to do |
| --- | --- | --- |
| Every request answers `503 SERVICE_UNAVAILABLE` | The migration hasn't been run, or Supabase is down | Run § 1. Check Supabase's status page. |
| Dashboard says "Your account doesn't have access" on your account | Signed in with a different account, or your ID isn't in `private.api_admins` | Check the User UID (§ 2) and add it if needed. |
| Dashboard says "Couldn't check your access" or "Couldn't load the API data" | The migration isn't run, or the network dropped | Run § 1, then reload. |
| `401 INVALID_API_KEY` with a key you just made | Copied with a space or cut short | Keys are `fc_live_` plus 43 characters, 51 in all. Copy again, or rotate. |
| `403 INSUFFICIENT_SCOPE` | The key doesn't have that permission | Make a new key with both permissions (permissions can't be edited). |
| `429 TOO_MANY_INVALID_KEYS` | That address sent 20 wrong keys in 10 minutes | Wait 10 minutes; fix the key in the bot. |
| `422 WORLD_REQUIRED` | The item is in several worlds' forges and the ores don't decide it | Expected: the bot asks the user and sends `world`. |
| A number differs from the website | A deploy changed a formula or the data | Compare `calculationModelVersion` and `catalogueRevision`. If they match and numbers still differ, it's a bug: note the request and `requestId`. |
| The log seems to stop | Rows older than 30 days are deleted on purpose | Nothing to fix. |
