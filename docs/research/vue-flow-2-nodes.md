# Vue Flow 2: form inputs in nodes, keyboard, touch, save/restore

Researched 2026-10-25 for issue #4. Package: `@xyflow/vue` 2.0.0-next.18, which pins `@xyflow/system` 1.0.0-next.4. Both were read from `npm pack` tarballs; nothing from them was executed.

Citations use two short forms:

- **`vue:N`** means line N of `@xyflow/vue@2.0.0-next.18/dist/index.mjs`. **`vue.d.ts:N`** means line N of its `dist/index.d.ts`.
- **`sys:N`** means line N of `@xyflow/system@1.0.0-next.4/dist/esm/index.mjs`.

Docs are from [next.vueflow.dev](https://next.vueflow.dev). Nothing here was tested in a browser. Every claim comes from the docs or a reading of the source.

## Typing vs canvas keys

**The rule:** Vue Flow ignores a key event when its target is an `INPUT`, `SELECT` or `TEXTAREA`, has a `contenteditable` attribute, or sits inside an element with class `.nokey` (`sys:897-905`, `isInputDOMNode`). Every built-in key handler checks this rule.

- **Arrow keys, Enter, Space and Escape on a node.** The node wrapper handles these in its own `keydown` listener (`vue:6032-6050`).
  - It returns early when the rule matches, so these keys stay with an input inside a node.
  - Enter, Space and Escape select or deselect the node (`vue:363`).
  - Arrow keys move a node that is **selected** and draggable, by 1px, or faster with Shift. They call `preventDefault()` and write the live-region message (`vue:6036-6048`).
- **Buttons inside a node are not covered.** A `<button>` doesn't match the rule. Enter or Space on an inner button bubbles up to the wrapper and toggles node selection as well as clicking the button. If the node is selected, arrow keys on that button move the node.
  - The fix is the `nokey` class on the button or its container (`sys:905`).
  - `nokey` doesn't appear on the [utility classes page](https://next.vueflow.dev/learn/customization/utility-classes), only in the source.
- **Backspace / Delete.**
  - The default `deleteKeyCode` is `'Backspace'` only (`vue:3859`). The **Delete key does nothing** unless you pass `['Backspace', 'Delete']`.
  - `null` turns key deletion off. The prop is typed `KeyFilter | null` (`vue.d.ts:1153`).
  - The listener runs on the **document**, not the canvas (`useKeyPress` targets `defaultDoc`, `vue:1223`, `vue:6295-6304`). It is registered with `actInsideInputWithModifier: false`, so Backspace in an input never deletes nodes.
  - However, Backspace pressed while focus is on a button *anywhere on the page* deletes every selected node and edge. Buttons only skip `preventDefault`, not the action (`vue:1237-1241`).
  - `onBeforeDelete` can veto or edit any deletion (`vue:4094-4101`, `vue.d.ts:1144-1147`).
- **Space and Shift are also global.** `panActivationKeyCode: 'Space'` and `selectionKeyCode: 'Shift'` (`vue:3855`, `vue:3860`) use the same document listener (`vue:6638-6639`).
  - `useKeyPress` calls `preventDefault()` on keydown unless the target is an input, button or link (`vue:1238-1240`).
  - So Space no longer scrolls the page when focus is on the body or a node.
- **`nodrag`** stops a drag from starting on that element. XYDrag's d3-drag filter rejects any target inside `.nodrag` (`sys:2333-2337`). The docs also say it suppresses the node selection that a click would cause ([utility classes](https://next.vueflow.dev/learn/customization/utility-classes)).
  - Without it, a drag that starts inside an `<input>` (for example, selecting text) moves the node instead. The filter checks only for `nodrag`, not for input elements.
  - The official custom-node example puts `class="nodrag"` on its input ([custom nodes](https://next.vueflow.dev/learn/customization/custom-nodes)).
- **`nopan` is already on every draggable node.** The node wrapper gets the `nopan` class whenever it is draggable (`vue:5949`). The pan/zoom filter rejects non-wheel events inside `.nopan` (`sys:2906-2909`).
- **`nowheel`** stops wheel zoom and scroll over an element (`sys:2902-2904`, `sys:2749`).
  - Nodes **don't** get it by default. With the default `zoomOnScroll`, scrolling inside a `<textarea>` or a scrollable output pane in a node zooms the canvas.
  - Add `nowheel` to scrollable inner elements ([utility classes](https://next.vueflow.dev/learn/customization/utility-classes)).
- **All three class names can be renamed** with the `noDragClassName`, `noPanClassName` and `noWheelClassName` props (`vue:3865-3867`).

## Keyboard focus and screen readers

- **Tab order follows the `nodes` array, not screen position.**
  - Nodes render in `getNodes` order (`vue:6196-6207`), each with `tabindex="0"` (`vue:5965`).
  - `EdgeRenderer` comes **before** `NodeRenderer` in the DOM (`vue:6801`, `vue:6804`), and edges are focusable by default (`vue:3847`). Tab therefore visits every edge before the first node.
  - Inner inputs are ordinary tab stops after their node's wrapper.
  - Focusing a node off-screen pans it into view (`autoPanOnNodeFocus`, `vue:6052-6061`; [accessibility](https://next.vueflow.dev/learn/advanced/accessibility)).
- **The node role is always `group`, and the docs disagree.**
  - The wrapper renders `role="group"`, `aria-roledescription="node"`, `aria-label` from `node.ariaLabel`, and `aria-describedby` pointing at a hidden instructions div (`vue:5966-5969`).
  - The [accessibility docs](https://next.vueflow.dev/learn/advanced/accessibility) say a node's `ariaRole` field overrides the role. The field is in the type (`vue.d.ts:1576`), but the runtime never reads it: `ariaRole` does not occur in `index.mjs`.
  - Workaround: `domAttributes` is spread *after* `role` (`vue:5970`), and its type doesn't exclude `role` (`vue.d.ts:1577`). So `domAttributes: { role: 'listitem' }` works.
- **Live region:** one hidden `<div aria-live="assertive" aria-atomic="true">` per flow, rendered unless `disableKeyboardA11y` is set (`vue:4891-4907`). Vue Flow only writes to it on arrow-key moves (`vue:6040`).
- **`ariaLabelConfig`** is merged over the defaults (`sys:804-806`, `vue:4620`).
  - **Keys:** `node.a11yDescription.default`, `.keyboardDisabled`, `.ariaLiveMessage` (a function `({direction, x, y}) => string`), `edge.a11yDescription.default`, plus labels for Controls, MiniMap and Handle (`sys:29-43`).
  - **The two node-description keys are swapped in the source.** The "keyboardDisabled" text is the one that mentions arrow keys (`sys:30-31`). The renderer shows `.keyboardDisabled` when the keyboard is *enabled* (`vue:4886`). The two swaps cancel out for the default text.
  - The docs' localisation example assumes the obvious meaning ([accessibility](https://next.vueflow.dev/learn/advanced/accessibility)). To change the instructions shown with keyboard support on, override **`node.a11yDescription.keyboardDisabled`**.
- **Custom announcements such as "Swapped step 2 and step 3" are possible but unofficial.** `ariaLiveMessage` is a plain field on the reactive store (`vue.d.ts:683`). `useVueFlowStore()` is exported (`vue:808`), so `useVueFlowStore().ariaLiveMessage = 'Swapped step 2 and step 3'` reuses the built-in region.
  - This isn't documented API.
  - Repeating the exact same string won't re-announce, because the text doesn't change.
  - Our own `aria-live="polite"` region is the safer choice. Arrow-key moves would still use Vue Flow's region.
- **Unique ids.** The docs example uses `id="text"` / `<label for="text">` inside a node ([custom nodes](https://next.vueflow.dev/learn/customization/custom-nodes)). If you copy it, every node has the same id. Derive ids from the node id instead (for example `` `${id}-search` ``).

## Touch

- **Dragging versus panning:**
  - A touch that starts on a draggable node drags the node.
  - Because every draggable node carries `nopan` (`vue:5949`, `sys:2906-2909`), **pan and pinch can only start on empty canvas**.
  - On a phone where nodes fill the screen, there may be nowhere left to grab.
- **Pinch:**
  - A second finger during a node drag aborts the drag (`sys:2273-2280`). The node stays where the drag had moved it (`sys:2302-2305`).
  - Pinch zoom is filtered per `touchstart`, so a pinch that starts on a node is rejected too (`sys:2906`).
  - With `zoomOnPinch: false`, a two-finger `touchstart` calls `preventDefault()` to stop native page zoom (`sys:2913-2916`).
- **Inputs in nodes on phones:**
  - Tapping still focuses the input. The d3-drag filter only blocks `.nodrag` (`sys:2333-2337`), and a drag starts only after moving more than `nodeDragThreshold` (default 1px, `vue:3851`, `sys:2289-2292`).
  - A small finger slide while tapping an input, though, moves the node unless the input has `nodrag`.
  - Inputs scale with the canvas zoom, so they get small when the canvas is zoomed out (the viewport applies `scale(zoom)`, `vue:6602`).
- **Shift+drag doesn't exist on touch.** The only touch-specific doc page covers tap-to-connect handles, not reordering ([touch device example](https://next.vueflow.dev/examples/interaction/touch-device)).

## Saving and restoring

- **`toObject()` returns `{ nodes, edges, viewport: { x, y, zoom } }`** (`vue:4259-4267`).
  - The node and edge objects are shallow copies, so `data` is shared until you stringify.
  - Nodes include whatever the change pipeline has written to them: `position`, `selected`, `dragging` and `measured` (`vue:463-478`).
  - Strip `selected`, `dragging` and `measured` before saving. `measured` is recomputed on render.
- **There is no `fromObject` in v2.** The string doesn't occur in `index.mjs`.
  - The official [Save and Restore example](https://next.vueflow.dev/examples/interaction/save-and-restore) restores with `setNodes(saved.nodes)`, `setEdges(saved.edges)` and `setViewport({ x, y, zoom })`.
  - In our managed `v-model:nodes` mode, assigning the saved nodes to our own array does the same thing.
- **Restoring the viewport on load:** `defaultViewport` is read once, when XYPanZoom mounts (`vue:6648-6658`). Passing the saved viewport there avoids a visible jump. A later `setViewport` also works (`vue:4323`).
  - If `fitView` is also set, it runs after init and overrides the saved viewport (`vue:4252`, `vue:5229`).
- **`reset()`** clears nodes and edges and returns to `defaultViewport` (`vue:4268-4276`).

## Swap detection (Shift+drag): confirmed

- **`@node-drag-stop` payload:** `{ event, node, nodes }`, where `event` is `MouseEvent | TouchEvent` (`vue.d.ts:877`, `vue.d.ts:886-893`).
  - It comes from XYDrag's `end` handler with the d3 `sourceEvent`, so `event.shiftKey` is the browser's state at release (`sys:2324-2325`, `vue:916-922`).
  - On touch the event is a `TouchEvent` with `shiftKey: false`.
- **Positions are committed before the stop event fires** (`sys:2313-2315`), so intersections are computed on the final position.
- **`getIntersectingNodes(node)` works with the event's node.**
  - It resolves the node by id to the internal node, with its live absolute position (`vue:4198-4200`, `vue:4212-4223`).
  - It skips the dragged node itself and counts partial overlap by default.
  - The official [Intersections example](https://next.vueflow.dev/examples/nodes/intersections) calls it from `@node-drag` the same way.
- **Multi-select still applies.**
  - `nodes` contains every node being dragged together (`sys:2070-2095`).
  - `selectNodesOnDrag` (default `true`, `vue:3853`) selects the grabbed node.
  - Swap only when `nodes.length === 1`.
  - `selectionKeyCode: 'Shift'` only affects drags that start on empty canvas, so it doesn't interfere.

## Recommendations

1. **Mark controls inside step nodes:**
   - `class="nodrag"` on every input, select and textarea;
   - `class="nodrag nokey"` on inner buttons;
   - `nowheel` on any scrollable preview or textarea.
2. **Set `:delete-key-code="null"`.** Delete steps with an explicit button instead. That removes the page-wide Backspace hazard. If key deletion is wanted, use `['Backspace', 'Delete']` and guard it with `onBeforeDelete`.
3. **Set `:edges-focusable="false"`**, because edges are derived from chain order. **Keep the `nodes` array in chain order**, re-sorting after each swap, so Tab order matches the chain.
4. **Label nodes and announce swaps ourselves:**
   - give each node `ariaLabel` (for example "Step 2: Replace");
   - use `domAttributes.role` rather than `ariaRole`;
   - announce swaps in our own polite live region.
5. **Override `node.a11yDescription.keyboardDisabled`** (not `.default`) to change the instructions, and say Backspace rather than "delete".
6. **Persist `toObject()`** with `selected`, `dragging` and `measured` removed. Restore by feeding the saved nodes to `v-model:nodes` and the saved viewport to `default-viewport`, without `fit-view`.
7. **Decide swaps in `@node-drag-stop`** with `event.shiftKey && nodes.length === 1`, using `getIntersectingNodes(node)[0]` as the target. Keep Move up / Move down buttons for keyboard and touch users.
8. **On phones, fall back to the list view (option C)**, or lock the canvas (`nodesDraggable: false`, larger pane margins). Pan and pinch only work on empty canvas.
