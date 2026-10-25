# Frontend UX prototypes: size, maintenance and performance

Measured 2026-10-25 on the ten variants in `prototypes/frontend-ux` (A–J). Method and caveats are at the end.

## Summary

| Variant | Extra packages | Size over baseline (brotli) | LCP, 1x CPU (DevTools MCP) | LCP, 4x CPU | Slowest keystroke, 4x CPU | Package health |
|---|---|---|---|---|---|---|
| A Node canvas (Vue Flow 2) | `@xyflow/vue` 2.0.0-next.18 | +56.2 KB | 279 ms | ≈2× B (see update) | ≈2.6× B | ⚠️ prerelease only, but very active |
| B Recipe | `vue-draggable-plus` (bundles SortableJS) | +15.4 KB | 138 ms | 416 ms | 32 ms | ⚠️ slowing |
| C Pipeline | `@formkit/drag-and-drop`, `reka-ui` | +46.6 KB | 213 ms | 956 ms | 72 ms | ✅ Reka, ⚠️ FormKit DnD quiet |
| D Blocks | `blockly` | +158.7 KB | 337 ms | 1048 ms | 56 ms | ✅ very active |
| E Command bar | none | +5.0 KB | 152 ms | 472 ms | 40 ms | n/a |
| F Conveyor | `gsap` | +35.5 KB | 161 ms | 484 ms | 32 ms | ✅ stable, closed development |
| G Track changes | none | +4.9 KB | 131 ms | 420 ms | 40 ms | n/a |
| H Debugger | none | +5.0 KB | 160 ms | 528 ms | 40 ms | n/a |
| I Spreadsheet | none | +4.0 KB | 162 ms | 552 ms | 72 ms | n/a |
| J Example first | none | +4.3 KB | 125 ms | 528 ms | 32 ms | n/a |
| Baseline (Vue + chain store) | none | 23.5 KB total | 52 ms | n/a | n/a | n/a |

**Responsiveness while editing:**
- Every variant stays well under the 200 ms "good" INP threshold, even with 20 steps and 4x CPU throttling.
- None produced a long task while typing.

**Where they differ:**
- **Load cost.** It follows bundle size: Blockly is worst, then Vue Flow, then Reka UI with FormKit.
- **DOM size.** It scales with how much each step renders: the spreadsheet, Blockly's SVG and the canvas are the largest.

## Update: variant A migrated to Vue Flow 2

On 2026-10-25, A was migrated from `@vue-flow/core` 1.48.2 to `@xyflow/vue` (Vue Flow 2), following the [official migration guide](https://next.vueflow.dev/learn/troubleshooting/migrate-to-v2).

### npm status
Vue Flow 2 has **no stable release** yet:
- The `next` tag is `2.0.0-next.18` (published 2026-10-11).
- The `latest` tag still points to `2.0.0-next.0`.

The prototype pins `2.0.0-next.18` exactly. Its peers are `vue ^3.5.27` and `@vueuse/core ^14.3.0`.

### What the migration involved for this variant
- **One package.** `Background` and `Controls` are built in, and `@xyflow/vue/style.css` is now the full theme, so the `theme-default.css` and controls stylesheets are gone.
- **`setupVueFlow()` instead of `useVueFlow()`.** The component that renders `<VueFlow>` must now provide the store; v2 has no global registry.
- **`edges-updatable` → `edges-reconnectable`.**
- **`fitView()` queues itself**, so the `nextTick`/`setTimeout` workaround was removed. The initial framing now uses the `fit-view` prop, because calling `fitView()` during setup warns "Viewport not initialized yet".
- **Edge changes are handled explicitly.** v2 treats a one-way `:edges` binding as *controlled* and warns when `@edges-change` is unhandled. Our edges are derived from the chain order, so the handler deliberately ignores them.
- **No other changes were needed.** The nodes were already replaced immutably, as v2 requires.

Behaviour is unchanged after the migration: add, drag to reorder, delete with reconnection, typing inside nodes, and the vertical layout on phones all work. The console is clean. v2 also shows a small "Vue Flow" attribution in the corner by default.

### Size (brotli, same build method)

| | Vue Flow 1 | Vue Flow 2 |
|---|---|---|
| Total bundle | 71.4 KB | 79.8 KB |
| Over baseline | +47.9 KB | **+56.2 KB** |
| Breakdown | `@vue-flow/core` ~43 KB (d3 included) | `@xyflow/vue` ~25 KB, `@xyflow/system` ~13 KB, d3 modules ~13 KB |
| CSS (minified) | 10.8 KB | 19.5 KB (`style.css` now carries the full theme, including minimap and resizer styles) |

The announcement says v2 is smaller, but that does not hold for this usage: it is about 8 KB larger. `@xyflow/vue/base.css` plus custom theming could recover some of the CSS.

### Performance
The baseline and B bundles were rebuilt as controls and came out byte-identical to the earlier session.

| Measurement | B (control) | A, Vue Flow 1 | A, Vue Flow 2 |
|---|---|---|---|
| **DevTools MCP trace, 1x CPU**: LCP | 138 → 141 ms (drift ~2%) | 253 ms | 279 ms |
| **DevTools MCP trace, 4x CPU**: LCP | 544 ms | not measured | 1282 ms (forced reflow: 146 ms, all inside Vue Flow) |
| **Scripted, 4x CPU**: LCP | 416 ms (then) / 548 ms (now) | 816 ms = 1.96× B | 1108 ms = 2.02× B |
| **Scripted**: long tasks during load | 328 / 445 ms | 748 ms = 2.28× B | 1016 ms = 2.28× B |
| **Scripted**: slowest keystroke | 32 / 40 ms | 80 ms = 2.5× B | 104 ms = 2.6× B |
| **Scripted**: long tasks while typing | 0 ms | 0 ms | **112 ms** |
| **Scripted**: JS heap | 4.4 MB | 8.2 MB | 7.5 MB |
| **Scripted**: DOM nodes | 702 | 2027 | 2052 |

The scripted harness ran about 30% slower in this session (see B), so A is compared as a ratio to B from the same session.

**Verdict:**
- **Load performance is unchanged in relative terms** (about 2× B), and memory is about 9% lower.
- **Typing got slightly worse.** v2 now produces a long task (over 50 ms) while typing with 20 nodes. The likely cause is v2 re-measuring nodes whose preview text changes size; this was not profiled further.
- **Still under the 200 ms INP threshold**, but A remains the heaviest option apart from Blockly.

## 1. Bundle size

Each variant was built as its own standalone production app (`vite.measure.config.ts`), so each figure is exactly what you would ship if you picked that variant.

| Variant | JS (minified) | CSS (minified) | gzip | brotli | brotli over baseline |
|---|---|---|---|---|---|
| Baseline (Vue + chain store) | 64.3 KB | 2.0 KB | 25.9 KB | 23.5 KB | n/a |
| A Node canvas (Vue Flow 1, original run) | 230.8 KB | 10.8 KB | 80.6 KB | 71.4 KB | +47.9 KB |
| A Node canvas (Vue Flow 2) | 260.3 KB | 19.5 KB | 90.8 KB | 79.8 KB | +56.2 KB |
| B Recipe | 112.9 KB | 4.8 KB | 42.9 KB | 38.9 KB | +15.4 KB |
| C Pipeline | 226.1 KB | 6.1 KB | 78.8 KB | 70.1 KB | +46.6 KB |
| D Blocks | 836.0 KB | 3.2 KB | 230.1 KB | 182.2 KB | +158.7 KB |
| E Command bar | 76.3 KB | 5.3 KB | 31.3 KB | 28.5 KB | +5.0 KB |
| F Conveyor | 167.0 KB | 6.5 KB | 65.4 KB | 59.0 KB | +35.5 KB |
| G Track changes | 76.6 KB | 5.4 KB | 31.2 KB | 28.5 KB | +4.9 KB |
| H Debugger | 76.4 KB | 6.9 KB | 31.3 KB | 28.5 KB | +5.0 KB |
| I Spreadsheet | 74.4 KB | 4.7 KB | 30.2 KB | 27.5 KB | +4.0 KB |
| J Example first | 74.4 KB | 5.7 KB | 30.5 KB | 27.8 KB | +4.3 KB |

**What each package costs (approximate share of the brotli bundle):**

| Package | Variant | ≈ brotli |
|---|---|---|
| `blockly` | D | ~156 KB (85% of D) |
| `@vue-flow/core` | A | ~43 KB |
| `gsap` (core + Flip) | F | ~31 KB |
| `reka-ui` (one dropdown menu) | C | ~14 KB |
| `@floating-ui/*` (pulled in by Reka) | C | ~6 KB |
| `vue-draggable-plus` (includes SortableJS) | B | ~9 KB |
| `@formkit/drag-and-drop` | C | ~8 KB |

C also pulls in more of Vue's runtime (Teleport, Transition): about 22 KB of `@vue/runtime-core` against about 15 KB elsewhere. Using Reka UI for a single menu is expensive; it pays off only if the app uses many of its components.

## 2. Maintenance

Sources: npm registry, the npm downloads API, and the GitHub REST API, queried 2026-10-25.

| Package | Latest | Last release | Releases in 12 months | Weekly downloads | Commits in last 90 days / last push | Open issues | License | Vue 3 + TS |
|---|---|---|---|---|---|---|---|---|
| `vue` (reference) | 3.5.44 | 2 days ago | 57 | 11.0 M | 100+ / 1 day | 946 | MIT | n/a |
| `@vue-flow/core` | 1.48.2 | 270 days ago | 3 | 405 k | 0 / 103 days | 19 | MIT | peer `vue ^3.3`, types ✓ |
| `@vue-flow/background` | 1.3.2 | 711 days ago | 0 | 261 k | same repo | n/a | MIT | ✓ |
| `@vue-flow/controls` | 1.1.3 | 444 days ago | 0 | 190 k | same repo | n/a | MIT | ✓ |
| `@xyflow/vue` (Vue Flow 2) | 2.0.0-next.18 (`next` tag) | 14 days ago | 19 | 210 | 94 / 3 days (xyflow monorepo) | 162 | MIT | peer `vue ^3.5`, types ✓ |
| `vue-draggable-plus` | 0.6.1 | 287 days ago | 1 | 186 k | 0 / 227 days | 108 | MIT | types ✓ |
| `sortablejs` (bundled by the above) | 1.15.7 | 256 days ago | 1 | 2.4 M | 0 / 215 days | 531 | MIT | types via `@types/sortablejs` |
| `@formkit/drag-and-drop` | 0.6.1 | 132 days ago | 3 | 91 k | 0 / 116 days | 11 | MIT | Vue adapter, types ✓ |
| `reka-ui` | 2.11.0 | 20 days ago | 23 | 1.3 M | 100+ / today | 266 | MIT | peer `vue >=3.4`, types ✓ |
| `blockly` | 13.4.0 | 12 days ago | 24 | 53 k | 100+ / 1 day | 394 | Apache-2.0 | framework-agnostic, types ✓ |
| `gsap` | 3.15.0 | 195 days ago | 4 | 3.9 M | GitHub is a release mirror / 195 days | 7 | GSAP "no charge" licence (not OSI) | framework-agnostic, types ✓ |

### Reading of the numbers
- **Vue Flow (A) is between major versions.** The prototype now uses v2; see the update above.
  - The v1 repo has had no commits in 90 days. Development moved to Vue Flow 2, published as `@xyflow/vue` in the `xyflow/xyflow` monorepo, which is active (94 commits in 90 days).
  - Version 2 is still a prerelease on npm: `latest` points to `2.0.0-next.0`, `next` to `2.0.0-next.18`. Starting a project today means either v1, which will need migrating, or a prerelease.
- **`vue-draggable-plus` (B) is slowing.** It has one release in 12 months and 108 open issues. The SortableJS code it bundles is also quiet (531 open issues).
- **`@formkit/drag-and-drop` (C) works but is quiet.** It is pre-1.0 (0.6.x) with no commits in 90 days. Its low open-issue count is a good sign.
- **Reka UI (C) and Blockly (D) are very actively maintained.**
- **GSAP (F) is healthy but developed in private.**
  - It is backed by Webflow and has frequent, careful releases. Its GitHub repo only mirrors releases, so commit counts mean nothing.
  - The licence is free for commercial use but is not an open-source licence. That's worth one sentence in the README.
- **Variants E, G, H, I and J have no third-party dependencies at all.**

## 3. Performance

### Page load (Chrome DevTools MCP, `performance_start_trace`)
These traces use the same 20-step chain (`?steps=20`), a production build served by `vite preview`, a cold cache and 1x CPU.

| Variant | LCP | Render delay | CLS | Trace insights flagged |
|---|---|---|---|---|
| Baseline | 52 ms | 44 ms | 0.00 | none |
| A Node canvas | 253 ms | 249 ms | 0.00 | **Forced reflow** (Vue Flow measures nodes) |
| B Recipe | 138 ms | 133 ms | 0.00 | DOM size |
| C Pipeline | 213 ms | 205 ms | 0.00 | DOM size |
| D Blocks | 337 ms | 331 ms | 0.00 | **Forced reflow**, third-party cost, DOM size |
| E Command bar | 152 ms | 148 ms | 0.00 | DOM size |
| F Conveyor | 161 ms | 156 ms | 0.00 | **Forced reflow** (measuring stations), a tiny layout shift (rounds to 0.00) |
| G Track changes | 131 ms | 126 ms | 0.00 | DOM size |
| H Debugger | 160 ms | 155 ms | 0.00 | DOM size |
| I Spreadsheet | 162 ms | 158 ms | 0.00 | DOM size |
| J Example first | 125 ms | 121 ms | 0.00 | DOM size |

TTFB was 3–8 ms everywhere (local server), so LCP is almost entirely JavaScript and render time.

### Interaction (scripted Chrome via the DevTools protocol, 4x CPU throttling)
Each run types 10 characters into the input text with the 20-step chain loaded. Every keystroke reruns all 20 steps and their diffs, and re-renders them. Figures are the median of 3 runs.

| Variant | LCP | Long tasks during load | Slowest keystroke (INP proxy) | Long tasks while typing | JS heap | DOM nodes |
|---|---|---|---|---|---|---|
| A | 816 ms | 748 ms | 80 ms | 0 ms | 8.2 MB | 2027 |
| B | 416 ms | 328 ms | 32 ms | 0 ms | 4.4 MB | 702 |
| C | 956 ms | 550 ms | 72 ms | 0 ms | 4.7 MB | 1689 |
| D | 1048 ms | 904 ms | 56 ms | 0 ms | 6.5 MB | 2603 |
| E | 472 ms | 391 ms | 40 ms | 0 ms | 3.5 MB | 1050 |
| F | 484 ms | 403 ms | 32 ms | 0 ms | 5.0 MB | 334 |
| G | 420 ms | 343 ms | 40 ms | 0 ms | 4.3 MB | 872 |
| H | 528 ms | 432 ms | 40 ms | 0 ms | 3.4 MB | 1127 |
| I | 552 ms | 453 ms | 72 ms | 0 ms | 3.8 MB | 2631 |
| J | 528 ms | 426 ms | 32 ms | 0 ms | 3.7 MB | 552 |

Notes:
- **The slowest keystrokes come from rendering many results at once.**
  - The 72–80 ms keystrokes (A, C, I) are the variants that render a full result diff for all 20 steps on every keystroke.
  - In production, debouncing the backend call, or diffing only visible steps, would cut this.
- **C has the slowest 4x-CPU load among the dependency-light designs.** The cause is Reka UI and FormKit setting up for 20 cards, not the pipeline idea itself. A hand-rolled menu would bring it close to G or H.
- **F has the smallest DOM.** Only the selected machine's settings are rendered.

## Method and caveats
- **Builds:** `VARIANT=<Name> npx vite build -c vite.measure.config.ts` for each variant, plus `EmptyVariant` as the baseline. Each build mounts only that variant, through the `@variant` alias.
- **Package attribution:** each package's share is its share of rendered (pre-minification) module bytes, applied to the brotli total. That makes it an estimate.
- **Chrome DevTools MCP:** the CPU-throttling, script-evaluation and typing tools were found but weren't callable in this session. So the MCP traces are page loads at 1x CPU. The throttled interaction metrics came from Playwright driving Chrome through the same DevTools protocol (`Emulation.setCPUThrottlingRate`, `Performance.getMetrics`), with the Event Timing and Long Tasks APIs.
- **INP proxy:** this is the longest Event Timing duration among keystroke interactions. Event Timing rounds to 8 ms.
- **Limits:** all numbers come from one machine on localhost with no network throttling. Treat them as relative, not absolute.
- **Maintenance snapshots:** GitHub "open issues" includes PRs, and monorepo stats (xyflow, Vue Flow v1) cover more than the one package.
