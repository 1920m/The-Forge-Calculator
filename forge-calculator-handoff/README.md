# Forge Calculator: handoff folder

Give this whole folder to the build agent, and paste `00-FIRST-PROMPT.md` as its first message.

| Path | What it is |
| --- | --- |
| `00-FIRST-PROMPT.md` | The first message for the agent: project, stack, what is placeholder, page behaviour, rules, order of work. |
| `docs/PRD.md` | Product requirements and build plan. The source of truth for every rule, formula and data table (ores, traits, weapons, armour, class odds by ore count 3 to 55, enhancement). |
| `docs/Handoff-Guide.md` | Account setup (GitHub, Supabase, Vercel), repo layout, engine function names, golden tests, page behaviour, design rules, open questions. Wins over the PRD where they differ. |
| `design/*.dc.html` | The visual and behavioural reference, one file per board: Main (calculator), Loading (skeleton), Ores, Weapons, Armour, HowItWorks, Mobile (older style). |
| `design/canvas.json` | How the boards are laid out on the design canvas. |
| `design/DESIGN-NOTES.md` | Tokens, world themes, animation values and component notes pulled out of the boards. |

## Important

- Everything shown in the design is placeholder: sample ores, sample traits, placeholder tiles for every image. No real ore data is implemented. The real data is in the PRD tables and goes into Supabase.
- The `.dc.html` files are a design-tool format. They do not open correctly on their own in a browser (they expect the design tool's `support.js` runtime). Read them as source: the markup, inline styles and the small script at the bottom show layout, colours, states and behaviour. Rebuild in React; do not copy the markup.
- The live design is also at the Forge Calculator Design link, which Albert can share on request.
