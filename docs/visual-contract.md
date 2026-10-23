# Approved visual contract

Cris's instruction, 23 October 2026: do not change the frontend's look, CSS, or file views until he requests a change. Component internals can be reorganised, but the resulting appearance must stay faithful to the supplied design.

The original `.dc.html` files and `canvas.json` are preserved without edits in `forge-calculator-handoff/design/`. They are references, not production markup to copy. When rebuilding behaviour in React, preserve the desktop boards' layout, typography, colours, textures, panel proportions and transitions. Responsive adaptation follows the existing brief; it is not permission to restyle the product.

The current unstyled infrastructure page is temporary and does not propose a replacement design. No production calculator styling has been created.

Any discovered accessibility, correctness or responsive issue that would require a visible departure should be explained to Cris with the concrete reason before changing the approved look.
