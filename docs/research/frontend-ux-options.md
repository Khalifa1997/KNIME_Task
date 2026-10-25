# Frontend UX options for building a transformation chain

Researched 2026-10-25. Package versions come from `npm view` on that date.

## The problem

A chain is an **ordered list** of steps. Each step has its own parameters: `replace` needs two strings, `append` needs one. The UI has to let users:

- add steps,
- fill in parameters,
- reorder steps,
- see what the order does.

It also has to stay accessible and responsive, as `AGENTS.md` requires. A wizard-style dialog asks for each parameter on a separate screen, so the user can't see the chain while editing it. Every option below edits parameters **inline** for that reason.

## Options

### A. Node canvas (n8n / KNIME style)
Each transformation is a node on a pannable canvas, and edges connect the nodes.

- **For:** familiar to KNIME, visually fun, and it could grow to support branching later.
- **Against:**
  - The backend chain is linear. Free placement and manual wiring are busywork, and they create states that have to be validated: disconnected nodes, branches, cycles. *Update: the chain is a single linked list, so the prototype draws edges automatically. That removes this problem; the points below remain.*
  - Canvas apps are hard to make responsive on a phone.
  - Vue Flow's accessibility docs cover Tab focus, Enter/Space selection, arrow-key node movement and a live region. They don't cover creating connections from the keyboard, so keyboard users would need a separate way to link nodes. Source: [Vue Flow accessibility](https://next.vueflow.dev/learn/advanced/accessibility).
- **Package:** the prototype now uses Vue Flow 2 (`@xyflow/vue` 2.0.0-next.18, still a prerelease); see `frontend-ux-measurements.md`. Originally researched: `@vue-flow/core` 1.48.2 (MIT, last published 2026-01-28). Its successor, `@xyflow/vue` 2.0, is announced but still a prerelease on npm (`next` tag 2.0.0-next.18). The project is between major versions right now. Sources: [Vue Flow 2.0 announcement](https://next.vueflow.dev/whats-new/2026-08-06), [npm](https://www.npmjs.com/package/@vue-flow/core).
- **Context:** KNIME's own workflow editor is a Vue app with a custom canvas, not a library. Source: [knime-oss/knime-ui](https://github.com/knime-oss/knime-ui). A reviewer at KNIME will compare a canvas against their own product.

#### A+: free placement, with Shift+drag to reorder (researched 2026-10-25)
The idea: a plain drag only moves a node, so users can shape the layout however they like. Shift+drag onto another node swaps the two steps. Lines always follow the chain order.

**Vue Flow 2 (`@xyflow/vue` 2.0.0-next.18) supports this.** Checked against the installed type definitions and in Chrome:
- **Shift is readable on drop.** `NodeDragEvent` carries the native `event`, so `event.shiftKey` is available on `@node-drag-stop`. In Chrome, every pointer and mouse event reported `shiftKey: true` during a Shift+drag.
- **The drop target can be found.** `getIntersectingNodes(node)` and `isNodeIntersecting(node, area)` work during the drag. The official [Intersections example](https://next.vueflow.dev/examples/nodes/intersections) highlights a node while another overlaps it, which is the hover feedback this needs.
- **Live feedback is possible.** `useKeyPress('Shift')` gives a reactive flag for showing "swap mode" while dragging.
- **Positions are easy to persist.** In managed `v-model:nodes` mode, positions are written back to our array. `snapToGrid`/`snapGrid` can keep free layouts tidy.
- **Shift has one existing binding, and it doesn't conflict.** `selectionKeyCode` defaults to `'Shift'`, but that only draws a selection box when dragging on *empty canvas*. Shift+drag on a node still drags the node (verified). One catch: if several nodes are selected, they move together, so swapping should only apply when `event.nodes.length === 1`. Alternatively, remap or disable `selectionKeyCode`.
- **Touch devices have no Shift key.** Phones need another way to reorder, such as the existing earlier/later buttons, a long-press, or a "reorder mode" toggle.

**VueUse (`@vueuse/core`, MIT) supplies building blocks, not a node canvas.** The latest is 15.0.0 (2026-09-16). Vue Flow 2 already depends on `^14.3.0`, so 14.4.0 is installed. The API below was checked in the 14.4.0 type definitions; the [v15 breaking changes](https://github.com/vueuse/vueuse/releases) don't touch these composables.
- **[`useDraggable`](https://vueuse.org/core/usedraggable/) for free placement.**
  - It returns reactive `x`/`y`/`style` for an absolutely positioned element.
  - Useful options: `containerElement` (bounds), `restrictInView`, `handle`, `axis`, `pointerTypes` (mouse, touch, pen), `buttons`, `disabled`, and `initialValue`.
  - `onStart`/`onMove`/`onEnd` receive the native `PointerEvent`, so `event.shiftKey` decides "move" or "swap" on drop.
  - The `<UseDraggable>` component has a `storageKey` that saves positions to localStorage.
- **`useKeyModifier('Shift')` for live feedback.** It is a reactive boolean for showing "swap mode" while dragging. `useMagicKeys` and `onKeyStroke` cover keyboard shortcuts.
- **Finding the drop target needs some glue code.** `useElementBounding` gives each card's rectangle and `useElementByPoint` gives the element under the pointer. There is no intersection helper like Vue Flow's `getIntersectingNodes`.
- **`onLongPress` for touch devices**, which have no Shift key.
- **v15 adds `useLiveAnnouncer`**, which could replace the hand-rolled screen-reader live region.
- **Two other composables don't fit.** `useSortable` (in `@vueuse/integrations`, wrapping SortableJS) only reorders *lists*. `useDropZone` is for files dropped from outside the page.

**What VueUse doesn't give you** (Vue Flow does):
- the connecting lines (you'd draw an SVG path between card rectangles yourself)
- pan and zoom
- auto-panning while dragging near an edge
- arrow-key node movement with screen-reader announcements
- fit-to-view, snap-to-grid, a minimap

**Comparison:**
- **A VueUse canvas is much lighter.** It costs a few KB tree-shaken, against Vue Flow 2's +56 KB. But the lines, panning and keyboard accessibility become our code to write and test.
- **The two combine well.** The cleanest Vue Flow implementation can still use VueUse helpers (`useKeyModifier`, `onLongPress`, `useStorage` for the saved layout) alongside it.
- **Stay on VueUse 14.x if combining.** That's the version Vue Flow 2 already pulls in. Adding VueUse 15 directly would bundle two copies.

**Detecting Shift (both options use Vue Flow).** These are the three ways to read Shift, checked against the installed sources. Both full versions were typechecked with `vue-tsc` against `@xyflow/vue` 2.0.0-next.18 and `@vueuse/core` 14.4.0.

| | `useKeyModifier('Shift')` (VueUse) | `useKeyPress('Shift')` (Vue Flow) | `event.shiftKey` on `NodeDragEvent` |
|---|---|---|---|
| Updates on | `mousedown`, `mouseup`, `keydown`, `keyup` via `getModifierState()` | `keydown`/`keyup`; resets on window `blur` and `contextmenu` | each `node-drag` and `node-drag-stop` event |
| Shift pressed mid-drag without moving the mouse | updates | updates | waits for the next pointer move |
| Shift released while the window is in the background | stays `true` until the next mouse or key event | resets on `blur` | n/a |
| Side effects | none (passive listeners) | `preventDefault()` on keydown unless `preventDefault: false` | none |
| Dependency | `@vueuse/core` must be declared (it's only transitive today) | part of `@xyflow/vue` | none |

**Conclusion:**
- **Decide the drop with `event.shiftKey`** in every version. It is the browser's own state at the moment of release.
- **A live key-state composable only matters for the highlight**, when Shift is pressed without moving the mouse.
- **Vue Flow's own `useKeyPress('Shift', { preventDefault: false })` covers that** with no new dependency, so VueUse doesn't make this easier.

### B. Recipe list (CyberChef style)
The screen has three areas:

- an operation palette,
- a "recipe" list of steps with their arguments inline,
- input and output panes.

The output updates live as the recipe changes. CyberChef builds each step's form from the operation's declared "ingredients". That is the same metadata-driven approach this project needs. Source: [CyberChef `RecipeWaiter`](https://github.com/gchq/CyberChef/blob/master/src/web/waiters/RecipeWaiter.mjs).

- **For:** proven, linear like the backend, responsive (it's a list), and straightforward to make accessible.
- **Against:** looks plain unless it is styled.

### C. Vertical pipeline with intermediate results (recommended)
This is B's list, drawn to look like A:

- Step cards are stacked top to bottom, with connector lines between them.
- A "+" between any two cards inserts a step there.
- Each card shows **the text as it leaves that step**, with the changed parts highlighted.

Reordering visibly changes every result below the moved step, which shows directly why order matters.

- **For:**
  - You get the node look without a graph library.
  - It can't be wired wrongly.
  - It works on phones as a single column.
  - Keyboard users can reorder with Move up / Move down buttons.
- **Against:** you build the connector styling and reorder animation yourself. Both are small jobs (see "Packages" below).
- **Backend implication:** the transform endpoint should return the intermediate output of every step, not just the final result.

### D. Snap-together blocks (Scratch / Blockly)
Steps are puzzle pieces that snap together.

- **For:** playful.
- **Against:**
  - Blockly renders its own workspace, so it would look different from the rest of the Vue app.
  - It is heavy for three to ten operations.
  - Blockly is built for programs with nesting and logic, which this chain doesn't have.
- **Package:** `blockly` 13.4.0 (Apache-2.0).

### E. Command bar / pipe syntax
The chain is typed as text, for example `replace "Fake" "Real" | append "!"`, with autocomplete.

- **For:** fast and keyboard-first.
- **Against:** needs a parser, and it isn't really no-code.
- **Better use:** a power-user alternative to C, kept in sync with the visual list. Treat it as a stretch goal.

### F. Select-to-act (add-on for B or C)
The user highlights text in the preview and picks an action, such as "Replace…". The step is created with the selected text already filled in as the first argument. This is fun, and it fits the "generate transformations" framing. It also needs no extra package.

## Packages

| Need | Option | Notes |
|---|---|---|
| Reorder animation | Vue's built-in `<TransitionGroup>` | Animates enter, leave and move on reorder. No dependency. [Vue docs](https://vuejs.org/guide/built-ins/transition-group) |
| Drag to reorder | `vue-draggable-plus` 0.6.1 (MIT) | SortableJS wrapper for Vue 3. Component, composable and directive APIs. |
| | `@formkit/drag-and-drop` 0.6.1 (MIT) | Small. The docs include a keyboard-accessible example with a live region. [docs](https://drag-and-drop.formkit.com/) |
| | `@atlaskit/pragmatic-drag-and-drop` 4.0.0 (Apache-2.0) | Framework-agnostic and low-level. Its accessibility helpers are React-only. [a11y guide](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines/) |
| Accessible popovers, comboboxes, menus | `reka-ui` 2.11.0 (MIT) | Headless Vue primitives for the "add step" picker and palette search. |
| Animation beyond CSS | `motion-v` 2.8.0 (MIT) | Declarative and Vue-native. |
| | `gsap` 3.15.0 | Every plugin, including Flip and Draggable, is now free for commercial use under GSAP's own "no charge" license (not OSI). [GSAP pricing](https://gsap.com/pricing/) |
| KNIME look | `@knime/components` 2.0.0 | KNIME's Vue component library. GPL-3 with additional permissions, so check the license before using it. |

Whatever drag library is chosen, keep Move up / Move down buttons too. Drag-and-drop on its own isn't keyboard- or screen-reader-accessible. Honour `prefers-reduced-motion` for all animation.
