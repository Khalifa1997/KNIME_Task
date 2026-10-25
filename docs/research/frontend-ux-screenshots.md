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

## B. Recipe (CyberChef)

Three-pane workbench: operations, the recipe, and input/output. Drag to reorder.

| Desktop | Mobile |
|---|---|
| ![B. Recipe, desktop](screenshots/B-desktop.png) | ![B. Recipe, mobile](screenshots/B-mobile.png) |

**Why not chosen:** _to be written._

## C. Pipeline

Vertical list that shows the result after each step, with changes highlighted.

| Desktop | Mobile |
|---|---|
| ![C. Pipeline, desktop](screenshots/C-desktop.png) | ![C. Pipeline, mobile](screenshots/C-mobile.png) |

**Why not chosen:** _to be written._

## D. Blocks (Scratch)

Blockly blocks generated from the metadata, snapped under "Start with text".

| Desktop | Mobile |
|---|---|
| ![D. Blocks, desktop](screenshots/D-desktop.png) | ![D. Blocks, mobile](screenshots/D-mobile.png) |

**Why not chosen:** _to be written._

## E. Command bar

Pipe syntax such as `trim | replace "a" "b"` with autocomplete, mirrored as a visual chain.

| Desktop | Mobile |
|---|---|
| ![E. Command bar, desktop](screenshots/E-desktop.png) | ![E. Command bar, mobile](screenshots/E-mobile.png) |

**Why not chosen:** _to be written._

## F. Conveyor belt

The text rides a belt through one machine per step, animated with GSAP.

| Desktop | Mobile |
|---|---|
| ![F. Conveyor belt, desktop](screenshots/F-desktop.png) | ![F. Conveyor belt, mobile](screenshots/F-mobile.png) |

**Why not chosen:** _to be written._

## G. Track changes

The text is the main view, with steps as margin comments.

| Desktop | Mobile |
|---|---|
| ![G. Track changes, desktop](screenshots/G-desktop.png) | ![G. Track changes, mobile](screenshots/G-mobile.png) |

**Why not chosen:** _to be written._

## H. Debugger

Step forward and back, breakpoints, and the text at every point in the chain.

| Desktop | Mobile |
|---|---|
| ![H. Debugger, desktop](screenshots/H-desktop.png) | ![H. Debugger, mobile](screenshots/H-mobile.png) |

**Why not chosen:** _to be written._

## I. Spreadsheet

One row per step. Rows become cards on phones.

| Desktop | Mobile |
|---|---|
| ![I. Spreadsheet, desktop](screenshots/I-desktop.png) | ![I. Spreadsheet, mobile](screenshots/I-mobile.png) |

**Why not chosen:** _to be written._

## J. Example first

Type the input and the wanted output; suggested chains are offered to start from.

| Desktop | Mobile |
|---|---|
| ![J. Example first, desktop](screenshots/J-desktop.png) | ![J. Example first, mobile](screenshots/J-mobile.png) |

**Why not chosen:** _to be written._
