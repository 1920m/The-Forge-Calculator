# Design notes

Pulled from the boards so the agent does not have to dig through the source. All sample data is placeholder.

## Boards
- `Main.dc.html`: calculator, World 4 theme, plays the load-in animation on open.
- `Loading.dc.html`: the same page frozen on the skeleton.
- `Ores.dc.html` (World 3), `Weapons.dc.html` (World 2), `Armour.dc.html` (World 4), `HowItWorks.dc.html` (World 1): each board starts in a different world to show the themes. In the app the world is global.
- `Mobile.dc.html`: older style, before themes, skeleton and footer. Use the desktop boards as the reference and make them responsive.

## Panel and tokens
CSS variables set on the page root and used by every panel:
`--bd` border, `--bd2` title-bar border, `--br` corner brackets and dot colour, `--bar` title bar and header fill, `--panel` panel fill, `--acc` accent (active nav underline, progress bar, links).
Corner brackets are eight 16px by 3px linear-gradient strips on the panel background. Green buttons use a smaller 10px bracket in #6bc04f on #26391f with border #4f8a3d.

## World themes
| World | Name | --bd | --bd2 | --br | --bar | --panel | --acc | Page base | Particles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Stonewake | #34322e | #4a4850 | #9a9a9a | #1c1b1e | #141210 | #e8d48a | #0b0a09 | dust, 20, slow rise |
| 2 | Forgotten Kingdom | #3a2a2b | #5a4346 | #8f7a7a | #1f1718 | #150f10 | #d9908f | #0c0809 | embers, 26, rise |
| 3 | Frostspire Expanse | #2a3a4c | #3f5873 | #8fb4d4 | #131c28 | #0e141c | #8fd0f2 | #080b10 | snow, 34, fall |
| 4 | Sakura | #4a2c38 | #6a3f50 | #d9a0b6 | #241520 | #160e12 | #f0a8c0 | #0f0a0c | petals, 22, fall and sway |

Each world also has a faint background texture (stone-block lines, crimson cracks, frost lattice, wave pattern) and an inset edge glow. The exact strings are in `THEME_JS` in each board (`theme()` method). Worlds 1 and 2 are the designer's suggestion. Particles: fixed pseudo-random seed per world, one nested span per particle, durations 14 to 58 seconds with negative delays so they are already mid-screen, `pointer-events:none`, hidden under `prefers-reduced-motion`.

## Motion
- Panels enter with a 0.6s fade and 14px rise, staggered 0.08s per column.
- Hover: ore tiles lift 3px and brighten; trait cards lift 2px; table rows tint; footer links nudge 3px.
- Enhance Equipment: grid-template-rows 0fr to 1fr over 0.6s with an expo-style ease (`cubic-bezier(.2,.8,.2,1)`), the rows fade and slide in with a 35ms stagger, bars grow over 0.7s, the chevron rotates 180 degrees. Traits panel docks under the variants table when open and sits full width at the bottom when closed, using the same transition on both.
- Skeleton: grey boxes (#1d1c20) with a white 9% shimmer sweeping left to right every 1.4s, staggered per column. Phases at 0.7s, 1.4s, 2.1s and 2.9s reveal left, centre, right and lower panels. A 3px progress bar under the header advances 25% per phase, then fades out.
- Logo and footer wordmark: a slow white shimmer sweep (5s) on the title, and a dotted "FORGE" wordmark fading out at the bottom of the footer.

## Interactions on the boards
- Quality presets (25/50/75/90/100) change the label, the defence and the enhancement values.
- Enhance Equipment toggle, trait-count preview (3/4/5/6; design aid only), world switch, ore selection on the Ores page, Replay loading in the footer.
