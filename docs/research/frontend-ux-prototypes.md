> The prototype folder (`prototypes/frontend-ux`) was deleted on 2026-10-25 once Vue Flow was chosen. This is its README, kept for the record. Screenshots of every variant are in [`frontend-ux-screenshots.md`](frontend-ux-screenshots.md).

# PROTOTYPE: chain editor UX (throwaway)

Ten different editors for the same single transformation chain, so they can be compared side by side. Delete this folder once a direction is chosen.

- **Open without installing anything:** double-click `dist/index.html`. Add `?variant=A` through `?variant=J` to the URL, or use the pink switcher bar (← / → keys also work when nothing is focused).
- **Dev server:** `npm install`, then `npm run dev`.
- **Type-check and rebuild:** `npm run build`. This runs `vue-tsc` and then writes `dist/index.html`.

All variants share one in-memory chain (`src/chain.ts`), so your edits carry over when you switch. The chain behaves like a linked list:

- Adding a step appends it to the end.
- Deleting a step joins its neighbours.
- Reordering moves a step without breaking the chain.

Parameter forms and validation come from mock metadata in `src/mock/transformations.ts`, which stands in for the Spring Boot API.

| Key | Variant | Extra packages | Notes |
|---|---|---|---|
| A | Node canvas | `@xyflow/vue` (Vue Flow 2, pinned to the `2.0.0-next.18` prerelease) | Edges are drawn automatically and can't be created by hand. Drop a node between two others to move it. The layout switches from horizontal to vertical below 800px wide. |
| B | Recipe (CyberChef) | `vue-draggable-plus` | Three-pane workbench with drag-to-reorder. |
| C | Pipeline | `@formkit/drag-and-drop`, `reka-ui` | Shows the result after each step, with changes highlighted. Select text in any result to create a Replace step from it. |
| D | Blocks (Scratch) | `blockly` | Blocks are generated from the metadata. Blocks not attached under "Start with text" are ignored. Missing required values show as block warnings. |
| E | Command bar | none | Pipe syntax such as `trim \| replace "a" "b"`, with autocomplete (an ARIA combobox) and a live visual mirror of the chain. |
| F | Conveyor belt | `gsap` | The text rides a belt through one machine per step (timeline animation); machines re-order with GSAP Flip. Click a machine to edit its settings inline. |
| G | Track changes | none | The text is the main view, with steps as margin "comments". Hover or focus a step to see exactly what it changed; select text to replace, remove or re-case it. |
| H | Debugger | none | Step forward and back, play, set breakpoints, scrub, and view the text at every point in the chain. |
| I | Spreadsheet | none | One row per step; change a row's operation in place. Rows become cards on phones. |
| J | Example first | none | Type what you have and what you want; a search (standing in for a backend endpoint) suggests chains to start from. |

Every package above is Vue 3-native or framework-agnostic, ships TypeScript types, and passes `vue-tsc --noEmit` under `strict`.

`typescript` is pinned to 6.0 because `vue-tsc` can't run on TypeScript 7, the new native compiler, yet.

## Measurements

Size, maintenance and performance results are in `docs/research/frontend-ux-measurements.md`.

To reproduce them:

- **Build one standalone app per variant:** `VARIANT=PipelineVariant npx vite build -c vite.measure.config.ts`, or `EmptyVariant` for the baseline. Output goes to `dist-measure/`, which is gitignored.
- **Serve them:** `npx vite preview -c vite.measure.config.ts --outDir dist-measure`, then open `http://localhost:4174/<Variant>/measure.html?steps=20`.
- **`?steps=20`** (works in the main app too) preloads the same 20-step chain, so variants are compared on equal terms.
