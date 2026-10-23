# Foundation validation

23 October 2026. Local checks; remote CI has not run because the GitHub connection has no push access.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, zero warnings |
| `npm run typecheck` | Passed |
| `npm test` | 32 passed, 1 explicit TODO |
| `npm run build` | Passed again with the final module configuration |
| npm dependency audit during final install | Zero known vulnerabilities reported |
| Design references | Unchanged against the local `main` baseline |

The unresolved TODO is intentional: the handoff's Dark Knight +10 value of 938.25 uses its rounded +0 value of 625.5, while the exact recipe average with two-decimal rounding produces 938.28. The standalone enhancement formula reproduces 938.25 when supplied 625.5. Do not call the entire end-to-end golden set verified until Cris's evidence settles the rounding sequence.

The direct in-game screenshots are represented as structured text fixtures. They confirm the Dark Knight card's whole-number 626 DEF and Hachiwari's 179.52 DMG, not every hidden rounding step. The test suite also exercises trait activation/full-strength boundaries, negative effect scaling, invalid/empty mixes, world slot mapping, Fichilliumorite filler behaviour, variant probability normalisation, the 55-row cap, and rejection of administrative credentials in public configuration.

The current page is an unstyled infrastructure placeholder. No full calculator screen, Supabase dataset, mobile visual verification, game-image pipeline, or remote deployment is claimed complete. The intended next work is PRD data reconciliation and schema/seed preparation, followed by the approved UI. Read `visual-contract.md` before changing any frontend appearance.
