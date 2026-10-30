This is a project for a no-code platform that allows users to generate text transformations as a series of operations.

It uses the following technologies:

1. Vue/TypeScript for the frontend.
2. Uses ESLint for linting, with the official Vue plugin (eslint-plugin-vue) and the accessibility rules (eslint-plugin-vuejs-accessibility).
3. Uses Java Latest LTS for the transformation processor as a Library API.
4. Spring Boot for the web API, calling the Java transformation library in-process.

Rules:

1. Everything produced on the frontend **MUST** be accessible and responsive.
2. All Vue components **MUST** be written in Composition API and use Typescript
3. **Never** commit on your own
4. Git worktrees are allowed for isolated implementation and parallel agent work. Use one writer per worktree, preserve the human's changes in the main checkout, and leave branches/worktrees available for review. Do not create independent clones or copies of the project.
5. **Never** use VueUse's `promiseTimeout` (or any fixed delay) to wait for the DOM or a component. Wait for the thing itself (`until(...)`, a `watch`) or use `nextTick`.
6. Use `nextTick` in its callback form, `nextTick(() => { ... })`, not `await nextTick()`.
7. Keep Vue render bindings simple: move collection lookups (`find`, `findIndex`), filtering, sorting, and repeated/non-trivial derived expressions into named `computed` values in `<script setup>`, then pass the resolved values to components. For slot- or loop-specific data, use a computed lookup keyed by a stable id or computed display items. Do not merely hide repeated render-time lookups in helper functions. Simple property access, indexing, and presentation conditionals can stay in templates; event handlers may perform action-specific lookups.
8. Design system sizes (text, spacing, dimensions, radii) are **rem** in multiples of 0.25rem (4px at the default), never `px`. Text sizes come from the `--text-*` tokens. Only 1px/2px lines (borders, outlines, focus rings), media queries and Vue Flow's own pixel coordinates stay in `px`. Stylelint enforces this (`npm run lint`).
