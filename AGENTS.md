# Forge Calculator project instructions

- Owner: Cris. Authorized accounts: Cristi Excelsis / cristiexcelsis@gmail.com. Repository: `1920m/Forge-Calculator`, confirmed by Cris.
- No permission exists to use Clearpath accounts, credentials, organizations, projects, authorship, or deployments for this project. Do not invoke a connector known to be bound to that identity. Do not disconnect or modify accounts belonging to other projects. Verify the authorized identity before publishing.
- Plugin connections and CLI authentication are separate. Never assume changing Git author information switches authentication. If tool routing exposes no way to select the intended connection, report the limitation and use an explicitly authenticated alternative; never silently fall back to another account.
- Preserve the approved design in `forge-calculator-handoff/design/`. Do not change CSS, appearance, layout, fonts or reference-board files without Cris's instruction. Internal components may change while preserving appearance.
- Cris corrected the game rule on 23 October 2026: armour rounds to the **nearest whole number**, not upward; weapons retain two decimals (the PRD's weapon ceiling remains the documented default). Keep intermediate values unrounded until the final display. Enhancement rounding order is provisional until directly measured. The original `1920m/Forge-Calculator` repository is confirmed; authenticate using Cris's account.
- Cris explicitly requested updating the PRD and handoff with this correction. His latest instructions and screenshots outrank historical document text.
- Run npm mutations sequentially. Never overlap dependency installations. Verify lint, typechecking and affected tests; run a production build when build/configuration changes warrant it.
- Keep all game maths in the pure engine. No invented game data or forced golden-test matches. No enhancement success odds, login or recipe-ownership toggle.
