# Validation report (API v1, 4 November 2026)

What was checked before review, how, and what's left to check on the live site.

## Summary

| Area | Result |
| --- | --- |
| Unit tests (`npm test`) | 253 passed, 22 files |
| Lint (`--max-warnings=0`) and TypeScript | Clean |
| Production build | Passes; `/developers` is static and refreshed hourly |
| Database security tests (real Postgres 16) | Passed |
| Rate-limit race (real Postgres 16) | 200 requests from 20 connections at 100 a minute: exactly 100 allowed, 100 refused |
| End to end through the built site and a real database | Passed (below) |
| Example clients (TypeScript and Python) against the built site | Passed |
| Discord command logic (discord.js) with simulated interactions | Passed |
| Developer page on desktop (1280 px) and phone (390 px) | No sideways scrolling; tables and code scroll inside their boxes |
| Live Supabase | **Not yet**: the migration hasn't been run there |

## Numbers match the website

`tests/api.test.ts` runs the same inputs through the API and through the code the calculator page and Profile use, and expects identical results:

- Dark Knight's Gauntlets forge result: multiplier 19.6667, 393.33 DMG, 0.2609% overall, 8.6957% in class, lock at 14, estimated DPS 2851.87 (hit 2160.56, procs 691.31).
- Quality 50%: 295 DMG.
- +9 with Blast Chip III: 5986.78.
- Armour (Dark Knight Chestplate, World 4, 20 ores): 1050 DEF, class unavailable at 20 ores.
- Loadout with a chestplate and Kitsune at +9: the same total as the Loadout page.
- Molds, class lock, enhancement and runes: the same as the calculator page.
- Lucky Cat Golemite: Epic, 23% mining help, 15% ore traits, no combat damage.

The worked example in [maths.md](maths.md) reproduces these by hand. `tests/api-docs.test.ts` checks that the developer page's examples are valid requests and give these numbers.

## Security

Database tests (`supabase/tests/api_security.sql`), run against the real migration:

- A non-admin account can't list or create keys, read stats or change settings. Revoke and rotate start with the same admin check.
- Hashes and secrets never appear in the key list.
- Another account renamed to "1920m" is still refused: only the account ID counts.
- Anonymous callers can't call any admin function, and nobody can read the `private` tables directly.
- A revoked key stops working on the next request; an expired key is refused; a key without a permission gets `INSUFFICIENT_SCOPE`.
- Rotation: the old and new keys both work during the overlap, then only the new one.
- 20 wrong keys from one address lock that address out for 10 minutes, including for valid keys.
- The usage log can only be finished with its one-time token, and only once.
- Clean-up deletes only old rate counters, old wrong-key counts and log rows older than 30 days; fresh rows stay.

Unit tests (`tests/api.test.ts`):

- Malformed keys are refused before any database call.
- Missing, invalid, revoked, expired and wrong-scope keys give the right status and code.
- Malformed JSON (400), wrong content type (415), bodies over 16 KB (413), unknown fields, duplicate ores, unknown IDs and out-of-range values (422) are refused with clear messages.
- A database outage gives 503, an unexpected error gives 500, and neither leaks internals.
- No response or log entry contains a key.

## End to end (built site, real Postgres, Supabase stand-in)

- Both endpoints with real keys; ETag then `304`; every error code above; usage rows written after the response.
- 60 parallel HTTP requests on a 30-a-minute key: 30 × `200`, 30 × `429`.
- Dashboard: signed-out and non-admin visitors are refused; create a key, copy it, use it; rotate (both keys work), revoke the old one (`401`, the new one still `200`); the anonymous-catalogue switch on gives `200` without a key, off gives `401`; no sideways scrolling on a phone.

## Example clients

Against the built site with a real key:

- `forge-api.ts`: 149 ores loaded; the second call served from the cache; weapon autocomplete for "dark" gives both Dark Knight weapons; the forge result builds the weapon embed (393.33 DMG, 0.51 s per hit, 2.25 hits/s, estimated DPS 2,851.87); quality 50 gives 295; armour embed has no attack speed or DPS; `INVALID_ORE` and `ITEM_KIND_MISMATCH` give the right player messages.
- `forge_api.py`: the same checks, plus `NOT_ENOUGH_ORES` and a wrong key (`401 INVALID_API_KEY` with a request ID).
- `tests/api-docs.test.ts` runs `forge-api.ts` against the real endpoint code: ETag `304` revalidation, error mapping, and a single retry after a short `429`.
- The discord.js example type-checks against discord.js 14 (strict TypeScript). The Python files compile.

Discord flow (discord.js example, simulated interactions):

- Item autocomplete only offers weapons when Weapon is chosen.
- The same ore picked twice is added up; an ore without a quantity gets a private message.
- Five quality buttons, 100% disabled, plus the website link.
- Another user pressing a button gets a private "Only the person who ran this can change it" and nothing is recalculated.
- The owner pressing 50% recalculates the same recipe in the same world at 50%.
- `WORLD_REQUIRED` shows a world menu (World 1–2, World 3); only the owner can pick; picking sends the recipe again with that world.
- An expired button says so.

## Still to do on the live site

1. Run `supabase/migrations/20261104100000_public_api.sql` in the Supabase SQL editor ([setup.md § 1](setup.md#1-turn-the-api-on-in-supabase)).
2. Open `/developers/dashboard` as 1920m, make a test key, run the three `curl` checks in [setup.md § 5](setup.md#5-testing), then revoke the test key.
3. Run the Discord example in a test server with a real bot token. The command logic was tested with simulated interactions, not on Discord itself.
