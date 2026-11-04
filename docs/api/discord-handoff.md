# Discord bot handoff

For whoever adds `/forge-calc` to a Discord bot. You don't need to rebuild your bot: take the pieces you need from the examples.

**Files** (also downloadable from [/developers](https://the-forge-calculator.vercel.app/developers#discord)):

| File | Use it for |
| --- | --- |
| `public/developers/examples/forge-api.ts` | TypeScript client: catalogue cache with ETag, typed errors, one retry after a short 429, autocomplete helper. No dependencies. |
| `public/developers/examples/discord-bot.ts` | discord.js v14: the command, autocomplete, embeds, quality buttons, world picker, error messages. |
| `public/developers/examples/forge_api.py` | The same client in Python (standard library only). |
| `public/developers/examples/discord_bot.py` | The same command for discord.py 2. |

**What you need**: a key from the site admin (starts with `fc_live_`). Put it in your bot's environment as `FORGE_API_KEY`. Never commit it or paste it in a channel.

## 1. The two endpoints

Base URL: `https://the-forge-calculator.vercel.app/api/v1`. Every request sends `Authorization: Bearer <key>`.

**`GET /catalogue`**: the game data. Use it for autocomplete lists and the ore lookup. Filters: `type` (`ores`, `weapons`, `armour`, `classes`, `races`, `runes`, `molds`, `golemites`, `pickaxes`), `world`, `ids`, `search`. It only changes when the game data is updated, so cache it: the clients keep it in memory and re-check it every 10 minutes with `If-None-Match`, which answers an empty `304` when nothing changed.

**`POST /calculate`**: the maths. JSON body with a `type`:

- `forge`: what a recipe makes. This is what `/forge-calc calculator` uses.
- `dps`: one weapon with enhancement, runes, armour and race.
- `loadout`: weapon plus armour pieces, like the site's Loadout page.
- `golemite`: a Golem companion from 10 to 50 ores.

Every success looks like `{ success: true, apiVersion, catalogueRevision, dataVersion, requestId, data, warnings }`. Every error looks like `{ success: false, error: { code, message, requestId, details? } }`. Branch on `code`; show `message` to players for `422` errors, since it's written for them.

Limits per key: 60 catalogue and 120 calculate requests a minute. Every response has `X-RateLimit-Remaining`; a `429` has `Retry-After`.

## 2. Example JSON

**Ore lookup**: `GET /catalogue?type=ores&ids=bismuth`

```json
{
  "success": true, "apiVersion": "v1", "catalogueRevision": 13, "dataVersion": "9ff7dc8737a6", "requestId": "req_…",
  "data": { "ores": [{
    "id": "bismuth", "name": "Bismuth", "rarity": "Divine", "image": "https://…/ores/bismuth.png",
    "multiplier": null, "multiplierRule": "average",
    "worlds": [4], "dropChance": { "oneIn": 1 }, "foundIn": "Fallen Guardian",
    "traits": [
      { "text": "+18% attack speed, random T3 attack rune on hit, rainbow wave of 125% weapon damage on Galaxite black hole", "appliesTo": ["weapon"] },
      { "text": "+15% crit chance, +15% crit damage, +15% Lethality, …", "appliesTo": ["armour"] }
    ],
    "hasTraits": { "weapon": true, "armour": true },
    "traitRule": { "minShare": 0.1, "fullShare": 0.3, "strengthAtMin": 0.1, "note": "A trait starts at 10% of the mix (at 10% strength) and reaches full strength at 30%." },
    "verified": true
  }] }
}
```

- `multiplier: null` with `multiplierRule: "average"` means the ore takes the average of the others.
- `appliesTo` says whether a trait is for weapons, armour, or both (`["armour", "weapon"]`).
- Anything unknown is `null` (`dropChance`, `foundIn`). Show "Unknown", never a guess.

**Calculation**: `POST /calculate`

```json
{ "type": "forge", "kind": "weapon", "item": "dark-knights-gauntlets", "quality": 100,
  "ores": [{ "id": "galaxite", "count": 5 }, { "id": "kyubite", "count": 5 },
           { "id": "fierce-jade", "count": 5 }, { "id": "bismuth", "count": 1 }] }
```

The parts of the answer a bot needs (the full answer has more):

```json
{
  "data": {
    "world": 2, "worldLabel": "1–2", "worldInferred": true, "kind": "weapon",
    "quality": { "percent": 100, "label": "Masterwork" },
    "ores": [{ "id": "galaxite", "name": "Galaxite", "count": 5, "share": 0.3125, "rarity": "Divine", "image": "…" }, "…"],
    "totalOres": 16, "multiplier": 19.6667, "rarity": "Divine",
    "item": {
      "id": "dark-knights-gauntlets", "name": "Dark Knight's Gauntlets", "class": "Gauntlets", "slot": null, "image": "…",
      "stat": { "name": "damage", "unit": "DMG", "value": 393.33 },
      "weapon": { "attackInterval": 0.51, "dps": { "estimated": true, "total": 2851.87, "hitsPerSecond": 2.2549, "…": "…" } },
      "chance": { "overall": 0.2609, "inClass": 8.6957, "classChance": 3 },
      "lock": { "lockable": true, "lockAt": 14, "locked": false }
    },
    "traits": { "active": [{ "ore": { "id": "galaxite", "name": "Galaxite" }, "share": 0.3125, "strength": 1,
                             "effects": [{ "text": "30% chance of a black hole (60% weapon damage AoE), +45% crit chance, +20% crit damage", "appliesTo": ["weapon"] }] }],
                "inactive": ["…"] },
    "links": { "calculator": "https://the-forge-calculator.vercel.app/?…" }
  },
  "warnings": [{ "code": "ESTIMATED_DPS", "message": "DPS is an estimate from the community damage model …" }]
}
```

- Chances are percentages: `0.2609` means 0.2609%.
- `attackInterval` is seconds per hit; `hitsPerSecond` includes attack-speed bonuses.
- For armour, `item.stat.name` is `"defence"`, `item.slot` is the slot, and `item.weapon` is `null` (no DPS).
- `links.calculator` opens the same recipe on the website.

Full examples of all four types are on [/developers](https://the-forge-calculator.vercel.app/developers#calculate), generated from the real engine.

## 3. The /forge-calc command

```
/forge-calc catalogue ore:<autocomplete>
/forge-calc calculator type:<Weapon|Armour> item:<autocomplete> ore1:<autocomplete> qty1:<1–99>
                       [ore2 qty2] [ore3 qty3] [ore4 qty4]
```

Discord limits that shaped this: 25 options per command, 25 autocomplete choices, 3 seconds to answer, 100 characters per custom ID, 5 buttons per row, 25 embed fields, 1024 characters per field.

**`catalogue`**: on submit, defer, look the ore up in the cached catalogue (by ID, or by name if someone typed instead of picking), and reply with an embed: rarity, multiplier (or "Takes the other ores' average"), worlds, drop chance, where it's found, "Good for weapons and armour", each trait labelled "Weapon trait", "Armour trait" or "Weapon and armour trait", and the trait rule in the footer. One API call at most, usually none.

**`calculator`**:

1. Collect the ore/quantity pairs. If someone fills an ore without a quantity (or the other way round), reply privately and stop. If the same ore is picked twice, add the amounts.
2. `deferReply()`, then `POST /calculate` with `type: "forge"`, `quality: 100`.
3. On success, edit the reply with the embed and the buttons (§ 5).
4. On `WORLD_REQUIRED`, edit the reply with a world menu instead (below).
5. On any other error, edit the reply with a short message (see `errorText` in the examples).

**Weapon embed**: name and image, class and world, quality, materials with shares, multiplier, rarity, damage, attack speed (seconds per hit and hits per second), estimated DPS, chance and lock, active traits with strength, a link to the website. The footer says the DPS is an estimate.

**Armour embed**: the same without attack speed or DPS, with defence and the slot.

<a id="world-required"></a>
**When the world is unclear**: most items are in one forge, or the ores decide it. When they don't, the API answers:

```json
{ "success": false, "error": { "code": "WORLD_REQUIRED", "message": "This item can be forged in more than one world with different odds. Send `world`.",
  "details": { "worlds": [2, 3], "labels": ["1–2", "3"] } } }
```

The examples show a select menu ("Which world are you forging in?") with those choices and send the same recipe again with `world`. The API never guesses, and neither should the bot.

## 4. Autocomplete

```ts
const ores = await api.ores();                      // cached; usually no network call
await interaction.respond(autocomplete(ores, typed)); // ≤ 25 choices, value = catalogue ID
```

- Names that start with what's typed come first, then names that contain it. An empty box shows the first 25.
- The choice's value is the catalogue ID (`fierce-jade`), so the calculation never depends on spelling.
- The `item` option filters by the `type` option already chosen: weapons for Weapon, armour for Armour.
- If the API can't be reached, answer with an empty list rather than nothing; Discord shows an error if autocomplete doesn't answer within 3 seconds.
- Warm the cache at start-up (call `api.ores()`, `api.weapons()` and `api.armour()` once) so the first autocomplete is instant.

## 5. Quality buttons

The result has five buttons: 25%, 50%, 75%, 90% and 100%. The current one is green and disabled. Pressing another:

1. Checks the presser is the person who ran the command. Anyone else gets a private "Only the person who ran this can change it" and nothing changes.
2. `deferUpdate()`, then sends **the same recipe** with the new `quality`, including the `world` from the first result, so the same item in the same forge is recalculated.
3. Edits the message with the new embed and buttons.

How the recipe is remembered: Discord custom IDs are limited to 100 characters, which isn't enough for a recipe. The discord.js example keeps recipes in memory under a short random token (`fcq:<token>:<quality>`) for 15 minutes, with the owner's user ID. The discord.py example keeps it on the button view, which times out after 15 minutes. After that, pressing a button says the calculation expired. If your bot restarts often or runs on several processes, store the token in your database instead.

## 6. Errors to handle

| Code | Status | What the bot should do |
| --- | --- | --- |
| `INVALID_ORE`, `INVALID_ITEM`, `ITEM_KIND_MISMATCH`, `NOT_ENOUGH_ORES`, `TOO_MANY_ORES`, `VALIDATION_ERROR` | 422 | Show `message` to the player. |
| `WORLD_REQUIRED` | 422 | Ask which world (§ 3). |
| `RATE_LIMITED` | 429 | "The calculator is busy, try again in N seconds" using `Retry-After`. The clients already retry once if the wait is 5 seconds or less. |
| `INVALID_API_KEY`, `API_KEY_REVOKED`, `API_KEY_EXPIRED`, `INSUFFICIENT_SCOPE` | 401/403 | Tell the player the bot is misconfigured, and alert yourself. Ask the site admin for a new key. |
| `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`, `TIMEOUT`, `NETWORK_ERROR` | 503/500/– | "Try again in a few minutes". Catalogue lookups keep working from the cache. |

Quote `requestId` when you report a problem; the admin can find the request with it.

## 7. Running the examples

**TypeScript (discord.js)**

```bash
npm i discord.js
# copy forge-api.ts and discord-bot.ts into your bot
FORGE_API_KEY=fc_live_... DISCORD_TOKEN=... DISCORD_APP_ID=... DISCORD_GUILD_ID=... npx tsx discord-bot.ts
```

To add it to an existing bot instead: register `forgeCalcCommand` with your other commands, create one `ForgeApi`, and call `handleForgeCalc(api, interaction)` from your `interactionCreate` handler. It ignores interactions that aren't its own.

**Python (discord.py)**

```bash
pip install discord.py
FORGE_API_KEY=fc_live_... DISCORD_TOKEN=... DISCORD_GUILD_ID=... python discord_bot.py
```

`DISCORD_GUILD_ID` makes the command appear at once in that server. Without it the command is registered globally, which can take up to an hour.

**Quick check without Discord**: `FORGE_API_KEY=fc_live_... python forge_api.py` prints the ore count and the Dark Knight's Gauntlets result.
