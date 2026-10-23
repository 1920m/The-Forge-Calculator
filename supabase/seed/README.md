# PRD source extraction

`source/` contains deterministic copies of the PRD's five CSV blocks, raw ore tables, raw trait descriptions and a source hash. Run `npm run data:extract` after an approved PRD change and `npm run data:check` to verify synchronization. CI checks the files against the current PRD.

These are source records, **not a ready-to-run database seed**. No script uploads them. Before import, reconcile outdated multipliers and missing ores with Cris's screenshots and the open wiki tabs, assign world pools from evidence, structure trait parameters, and retain confidence/provenance. In particular, a trait row without a multiplier row must not receive a made-up value.

Never replace a measured class-odds row with normalized values just because its displayed percentages sum to 99 or 101. Blank source cells mean zero. The existing weapon and armour source CSVs preserve the published denominators; documented defaults such as the unresolved Wolf 1/4 override belong in the reviewed seed transformation, with the source discrepancy retained.

## Wiki audit

`wiki-ores-2026-10-23.csv` records all 150 displayed ore names, multipliers and rarities observed in Cris's open [Ores tab](https://forgewiki.org/wiki/Ores), last edited 20 October 2026. Attribution: The Forge Official Roblox Wiki contributors, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The statistical snapshot is adapted from their All Ores table; retain this attribution and license with redistributed adaptations.

Run `npm run data:audit` to regenerate `wiki-ore-audit.json`. The report identifies 17 ore names absent from the PRD multiplier tables, two multiplier conflicts (Aite and Arcane Crystal), and no rarity conflicts after treating Mythical/Mythic as aliases. These are source observations, not confirmation from the game. The PRD wins conflicting values until Cris supplies in-game evidence. Wiki-only entries must carry an Unverified badge. In particular Fichillium's zero multiplier does not prove it is a forgeable material.

The wiki's Used For column describes trait applicability; it must not restrict the materials available for weapon versus armour forging. Full trait effects require individual ore pages or direct in-game evidence.

`source/provenance.json` flags six class-odds rows whose totals lie outside 99–101: weapon counts 9 and 12, and armour counts 10, 13, 16 and 21. Keep them Unverified and preserve the source values pending confirmation.
