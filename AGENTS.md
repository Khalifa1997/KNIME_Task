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
4. **Never** create git worktrees, clones or copies of the project in another folder. Work only in this repository, switching branches here, so the human can test the changes from this folder.
5. **Never** use VueUse's `promiseTimeout` (or any fixed delay) to wait for the DOM or a component. Wait for the thing itself (`until(...)`, a `watch`) or use `nextTick`.
6. Use `nextTick` in its callback form, `nextTick(() => { ... })`, not `await nextTick()`.
7. Design system sizes (text, spacing, dimensions, radii) are **rem** in multiples of 0.25rem (4px at the default), never `px`. Text sizes come from the `--text-*` tokens. Only 1px/2px lines (borders, outlines, focus rings), media queries and Vue Flow's own pixel coordinates stay in `px`. Stylelint enforces this (`npm run lint`).
