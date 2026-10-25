# Forge Calculator

A free, no-login calculator for the Roblox game **The Forge**. Pick your ores and see which weapon or armour classes and variants you can forge and how likely each one is. It also shows the traits that transfer, the damage or defence at any craft quality, and the stat at every enhancement level from +0 to +10.

Built with Next.js (App Router, TypeScript), hosted on Vercel, with game data and images in Supabase.

## Run it locally

```sh
npm ci
npm run dev        # http://localhost:3000
npm run check      # lint, typecheck, tests and a production build
```

No environment variables are needed. The app reads the public, read-only Supabase project by default and falls back to the bundled `data/catalogue.json` if Supabase can't be reached. To point it at another project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).

## How the data flows

1. `docs/PRD.md` is the source of truth for every ore, trait, weapon, armour piece and odds table.
2. `npm run data:build` turns it into `data/catalogue.json`.
3. The same JSON is published as a row in the Supabase table `catalogue_releases`. The site uses the newest row, cached for an hour.
4. Images live in the Supabase Storage bucket `forge-images` (`ores/<id>.png`, `weapons/<id>.png`, `armour/<id>.png`). `data/images.json` lists the ones that exist; anything missing shows the striped placeholder tile.

## The rules the calculator uses

| Rule | Formula | Status |
| --- | --- | --- |
| Forge slots | Up to 4 different ore types per craft, any amount of each | Confirmed in game |
| Multiplier | M = sum(multiplier × count) ÷ total ores | Confirmed in game |
| Class odds | Look up the total ore count (3 to 55) in the odds table; above 55 use the 55 row | Confirmed in game |
| Variant odds | (1 ÷ N) ÷ sum(1 ÷ N) inside the class | Confirmed in game |
| World pools | Slots 3–5 are Gauntlets/Katana/Greatsword in World 1–2, Mace/Axe/Spear in World 3, Mace/Katana/Spear in World 4; each world has its own variants, plus Funguy shop blueprints where the shop sells that class, and Halloween weapons in World 4 | Confirmed in game |
| Primary ore | Largest count, ties go to the higher multiplier; sets the look and rarity | Confirmed in game |
| Traits | Need a 10% share; strength = 0.10 + 4.5 × (share − 0.10), full at 30%. Chances, damage and stat amounts all scale; durations do not appear to | Confirmed in game |
| Defence | round(2 × health % × M × quality) | Confirmed in game |
| Damage | 2 × base damage × M × quality, rounded to 2 decimals | Confirmed in game |
| Enhancement | stat × (1 + 0.05 × level), +0 to +10 | Confirmed in game |
| DPS | damage × (1 + lethality) × crit blend × hits per second, plus explosion, burn, poison, smite, black hole and lightning. Hits per second = (1 + attack speed) ÷ true swing time; crit blend = chance × (1.45 + crit damage) + (1 − chance). Ported from the wiki's DPS calculator; ores only (no race, runes or achievements) | From the wiki calculator |

Golden tests (`tests/`) reproduce the Dark Knight Chestplate (12.51x, 626 DEF), the Hachiwari (10.88x, 179.52 DMG) and the Shogun's Leggings crafted in game.

## Still to confirm in game

- The quality label ranges (Broken to Masterwork) are unverified.
- Wiki-only items (Vanguard helmet and leggings, Reaper Scythe, Batwing Reaver, Bo Staff) are marked Unverified.
- The worlds of the 16 wiki-only ores. (Worlds 1 and 2 are treated as one world, 1–2, because they share the same pools and odds.)
- Whether trait durations and cooldowns scale (the item card does not show them, so they are left as listed).

See [FILES.md](FILES.md) for what every file does.

Fan-made. Not affiliated with the game's developers or Roblox. Game data from the community wiki (CC BY-SA 4.0).
