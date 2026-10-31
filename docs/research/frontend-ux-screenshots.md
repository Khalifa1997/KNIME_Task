# Frontend UX prototypes: screenshots

Captured 2026-10-25 from the throwaway prototype (`prototypes/frontend-ux`, since deleted), rebuilt from its latest source just before capture. Every variant shows the same three-step chain on the input `  Fake Python is fake  `: **Trim → Replace "Fake" with "Real" → Append "!"**.

- **Desktop:** 1440 × 900.
- **Mobile:** 390 × 844 at 2× pixel density.
- The pink bar at the bottom was the prototype's variant switcher, not part of any design.

The chosen direction is **A. Node canvas**, built with Vue Flow 2. The other nine are kept here so the reasons for rejecting them can be documented. Their descriptions, packages and measurements are in [`frontend-ux-options.md`](frontend-ux-options.md), [`frontend-ux-measurements.md`](frontend-ux-measurements.md) and [`frontend-ux-prototypes.md`](frontend-ux-prototypes.md).

## A. Node canvas (chosen)

Each step is a node on a pannable canvas. Edges are drawn automatically in chain order.

| Desktop | Mobile |
|---|---|
| ![A. Node canvas, desktop](screenshots/A-desktop.png) | ![A. Node canvas, mobile](screenshots/A-mobile.png) |

**Why chosen:** it scales the furthest. It can later show branches or nodes with more than one input or output without redesigning the UI, the whole Chain fits on one screen instead of a long scroll, and Shift+drag swaps two Steps directly. The cost: +56 KB and about twice the recipe's load time, on a pinned Vue Flow prerelease.

## B. Recipe (CyberChef)

Three-pane workbench: operations, the recipe, and input/output. Drag to reorder.

| Desktop | Mobile |
|---|---|
| ![B. Recipe, desktop](screenshots/B-desktop.png) | ![B. Recipe, mobile](screenshots/B-mobile.png) |

**Why not chosen:** the runner-up. It's proven, light (+15 KB) and easy to make accessible, and a scroll area of its own plus `vue-draggable-plus` would fix its scrolling and reordering. But it's a list, so it can't grow into branches or Steps with more than one input or output.

## C. Pipeline

Vertical list that shows the result after each step, with changes highlighted.

| Desktop | Mobile |
|---|---|
| ![C. Pipeline, desktop](screenshots/C-desktop.png) | ![C. Pipeline, mobile](screenshots/C-mobile.png) |

**Why not chosen:** the most scrolling of all. Every card shows its full result, so a long Chain becomes a very long page, and reordering means dragging through the whole list. It's linear by design. The canvas kept its best idea: every node shows its own result.

## D. Blocks (Scratch)

Blockly blocks generated from the metadata, snapped under "Start with text".

| Desktop | Mobile |
|---|---|
| ![D. Blocks, desktop](screenshots/D-desktop.png) | ![D. Blocks, mobile](screenshots/D-mobile.png) |

**Why not chosen:** too heavy and built for the wrong job. Blockly alone is about 156 KB brotli (85% of the variant's 182 KB bundle, +158.7 KB over the baseline, 836 KB minified JS), nearly three times the canvas. It is made for programs with nesting and logic, it looks unlike the rest of the app, it's cramped on a phone, and it has no keyboard support without a plugin.

## E. Command bar

Pipe syntax such as `trim | replace "a" "b"` with autocomplete, mirrored as a visual chain.

| Desktop | Mobile |
|---|---|
| ![E. Command bar, desktop](screenshots/E-desktop.png) | ![E. Command bar, mobile](screenshots/E-mobile.png) |

**Why not chosen:** too complicated for a no-code tool. Typing a syntax isn't no-code, and it needs a parser. It could come back later as a power-user add-on.

## F. Conveyor belt

The text rides a belt through one machine per step, animated with GSAP.

| Desktop | Mobile |
|---|---|
| ![F. Conveyor belt, desktop](screenshots/F-desktop.png) | ![F. Conveyor belt, mobile](screenshots/F-mobile.png) |

**Why not chosen:** the prettiest, but it makes users wait. The backend returns every result at once, and the animation then holds them back machine by machine. With many Steps that gets slow.

## G. Track changes

The text is the main view, with steps as margin comments.

| Desktop | Mobile |
|---|---|
| ![G. Track changes, desktop](screenshots/G-desktop.png) | ![G. Track changes, mobile](screenshots/G-mobile.png) |

**Why not chosen:** fine for a few Steps, but the margin becomes a long scrolling column as the Chain grows, and the order is hard to see and to change.

## H. Debugger

Step forward and back, breakpoints, and the text at every point in the chain.

| Desktop | Mobile |
|---|---|
| ![H. Debugger, desktop](screenshots/H-desktop.png) | ![H. Debugger, mobile](screenshots/H-mobile.png) |

**Why not chosen:** too complicated for building a Chain. Stepping through is for debugging, not editing, and it's still a linear list.

## I. Spreadsheet

One row per step. Rows become cards on phones.

| Desktop | Mobile |
|---|---|
| ![I. Spreadsheet, desktop](screenshots/I-desktop.png) | ![I. Spreadsheet, mobile](screenshots/I-mobile.png) |

**Why not chosen:** too basic. It's a list with columns, with the same scrolling and reordering problems as B and C, and the largest DOM of all with 20 Steps.

## J. Example first

Type the input and the wanted output; suggested chains are offered to start from.

| Desktop | Mobile |
|---|---|
| ![J. Example first, desktop](screenshots/J-desktop.png) | ![J. Example first, mobile](screenshots/J-mobile.png) |

**Why not chosen:** suggesting a Chain needs search logic in the backend, which is beyond this task, and the suggestion still needs another editor to change it. Future work on top of the canvas.
