# Frontend toolchain: versions, linting, accessibility lint, tests

Researched 2026-10-25. Package versions come from `npm view` on that date. Every "tested" claim was run in a throwaway project scaffolded with `create-vue` 3.24.0 on Node 24.20.0, outside this repo.

## Versions (latest stable on npm)

| Package | Latest | Notes |
|---|---|---|
| `vue` | 3.5.44 | 3.6 is still a prerelease (`rc` tag 3.6.0-rc.13, 2026-10-23). [npm](https://www.npmjs.com/package/vue) |
| `vite` | 8.3.5 | Needs Node 20.19+ or 22.12+. [Vite guide](https://vite.dev/guide/) |
| `@vitejs/plugin-vue` | 6.0.10 | Peers: `vite ^5–^8`, `vue ^3.2.25`. [npm](https://www.npmjs.com/package/@vitejs/plugin-vue) |
| `vue-tsc` | 3.3.13 | Declares peer `typescript >=5.0.0`, but this is misleading (see below). [npm](https://www.npmjs.com/package/vue-tsc) |
| `typescript` | 7.0.2 (`latest`) | 6.0.3 is the last 6.x release. [npm](https://www.npmjs.com/package/typescript) |
| `vitest` | 5.0.5 | Peers `vite ^6.4–^8`. Needs Node `^22.12 \|\| ^24 \|\| >=26`. [npm](https://www.npmjs.com/package/vitest) |
| `@vue/test-utils` | 2.5.1 | Peer `vue 3.x`. [npm](https://www.npmjs.com/package/@vue/test-utils) |
| `jsdom` | 30.1.3 | Vitest DOM environment. |
| `oxlint` | 1.89.0 | Needs Node 20.19+ or 22.12+. [npm](https://www.npmjs.com/package/oxlint) |
| `eslint-plugin-vue` | 10.11.1 | Peer `eslint ^8.57–^10`. ESLint itself is 10.13.0. |
| `eslint-plugin-vuejs-accessibility` | 2.6.3 | Peer `eslint ^5–^10`. Published 2026-10-21. |
| `eslint-plugin-oxlint` | 1.89.0 | Keep it in step with `oxlint`. |

## Do they fit together?

- **Yes, with TypeScript pinned to 6.0.x.** Tested: `vue` 3.5.44 + `vite` 8.3.5 + `@vitejs/plugin-vue` 6.0.10 + `vue-tsc` 3.3.13 + `typescript` 6.0.3 + `vitest` 5.0.5 + `@vue/test-utils` 2.5.1 + `jsdom` 30.1.3. `vue-tsc --build`, `vitest run` and `vite build` all pass.
- **`vue-tsc` does not work with TypeScript 7.** Tested: with `typescript` 7.0.2, `vue-tsc --build` fails at startup with `ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './lib/tsc'`. The npm peer range (`>=5.0.0`) will not warn about this.
  - The Vue Language Tools maintainer confirms it: all published packages "still require the TypeScript 6 JS API, because TS 7.0 ships no programmatic API or plugin mechanism". Real support waits for the TS 7.1 API. Source: [vuejs/language-tools#5381](https://github.com/vuejs/language-tools/issues/5381) (comment of 2026-07-12).
  - TS 7.1 is in beta (`beta` tag 7.1.0-beta on npm), so this may change soon. Don't plan around it.
- **The official scaffolder pins the same thing.** `create-vue` 3.24.0 (2026-09-16) generates `"typescript": "~6.0.0"`, `"vue-tsc": "^3.3.11"`, `"vite": "^8.2.2"`. It still generates `"vitest": "^4.1.11"`, but Vitest 5 passed the generated test after upgrading. Source: output of `npx create-vue@3.24.0 app --ts --vitest --eslint`.

## Linting: oxlint and eslint-plugin-vue

- **oxlint lints only the `<script>` blocks of `.vue` files.** Templates are skipped. Sources: [Oxlint usage](https://oxc.rs/docs/guide/usage/linter) ("Framework files (`.vue`, …) by linting only their `<script>` blocks"), [compatibility matrix](https://oxc.rs/compatibility) ("Vue … No template linting yet").
- **oxlint has a native `vue` plugin with 46 rules, all script-side.** Examples: `define-props-declaration`, `no-async-in-computed-properties`, `no-export-in-script-setup`, `no-lifecycle-after-await`, `require-typed-ref`, `valid-define-props`, `valid-define-emits`. There are no template rules such as `require-v-for-key` or `valid-v-model`. Sources: [Built-in plugins](https://oxc.rs/docs/guide/usage/linter/plugins) ("eslint-plugin-vue rules that work with script tags"), [rule list](https://oxc.rs/docs/guide/usage/linter/rules).
  - Configure it in `.oxlintrc.json` with `"plugins": [..., "vue"]`. It is off by default.
- **`<script setup lang="ts">` works.** Tested: oxlint 1.89.0 reported `vue/no-async-in-computed-properties` and `no-debugger` in a `<script setup lang="ts">` block.
  - It did *not* report unused bindings (`no-unused-vars`) in the SFC. That is expected: oxlint can't see what the template uses. [oxc#15761](https://github.com/oxc-project/oxc/issues/15761) explains this.
- **Template support is an open issue.** Full `eslint-plugin-vue` compatibility is "not a target at this time". The plan is a custom Vue parser in oxc. Source: [oxc#15761](https://github.com/oxc-project/oxc/issues/15761) (open, last updated 2026-10-21).
- **Loading `eslint-plugin-vue` as an oxlint JS plugin does not help.** JS plugins are alpha, and "custom file formats and parsers (e.g. Svelte, Vue, Angular)" are listed as not supported yet. Source: [JS Plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins).
  - Tested: the name `vue` is reserved for the native plugin, so it needs an alias (`{ "name": "vue-js", "specifier": "eslint-plugin-vue" }`). Every template rule then fails with "Use the latest vue-eslint-parser" at line 2:1 instead of linting.
- **The supported pattern is oxlint first, then ESLint.** `eslint-plugin-oxlint` turns off ESLint rules that oxlint already covers, and the documented script is `"lint": "oxlint && eslint"`. Source: [eslint-plugin-oxlint README](https://github.com/oxc-project/eslint-plugin-oxlint). `create-vue` scaffolds exactly this setup: `.oxlintrc.json` with the `vue` plugin, plus `eslint.config.ts` with `pluginVue.configs['flat/essential']` and `pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json')`.

## Accessibility lint

- **oxlint has no Vue accessibility lint.** Its `jsx-a11y` plugin (about 36 rules) only reads JSX, and oxlint never parses the template. Sources: [rule list](https://oxc.rs/docs/guide/usage/linter/rules), [compatibility matrix](https://oxc.rs/compatibility).
- **Running `eslint-plugin-vuejs-accessibility` through oxlint `jsPlugins` fails.** Tested: it gives the same "Use the latest vue-eslint-parser" error as above.
- **Run `eslint-plugin-vuejs-accessibility` 2.6.3 in ESLint instead.** It works next to oxlint. Tested with `pluginVueA11y.configs['flat/recommended']` in the scaffolded `eslint.config.ts`. On one deliberately bad SFC it reported:
  - `click-events-have-key-events` and `no-static-element-interactions` on `<div @click>`
  - `alt-text` on `<img>`
  - `form-control-has-label` on an unlabelled `<input>`

  `eslint-plugin-vue` also caught `require-v-for-key`. oxlint caught none of these.
- **Lint rules are only a first filter.** Keyboard and screen-reader behaviour still need tests. Vue's docs point to browser-based runners for real native DOM events. Source: [Vue testing guide](https://vuejs.org/guide/scaling-up/testing).

## Testing

- **Vue recommends Vitest with `@vue/test-utils`.** Vitest "can leverage the same configuration and transform pipeline directly from Vite". For components, the guide says "We recommend using `@vue/test-utils`", and `@testing-library/vue` "should be used with caution" because of Suspense issues. For end-to-end tests it recommends Playwright. Source: [Vue testing guide](https://vuejs.org/guide/scaling-up/testing).
- **Tested:** `vitest` 5.0.5 + `@vue/test-utils` 2.5.1 + `jsdom` 30.1.3 runs the scaffolded `HelloWorld` spec.
- **Optional:** Vitest browser mode (`@vitest/browser` 5.0.5 with `vitest-browser-vue` 3.1.0, which peers `vitest ^4 || ^5`) runs component tests in a real browser. This would cover the keyboard-interaction checks above. Not tested here.

## Recommendation

Pin these versions:

- `vue` ^3.5.44
- `vite` ^8.3.5
- `@vitejs/plugin-vue` ^6.0.10
- `vue-tsc` ^3.3.13
- **`typescript` ~6.0.3.** Do not take the `latest` 7.x until `vue-tsc` supports it.
- `vitest` ^5.0.5
- `@vue/test-utils` ^2.5.1
- `jsdom` ^30.1.3
- Node 24 LTS

For linting, follow the `create-vue` setup:

- **oxlint 1.89.0 runs first**, with the native `vue`, `typescript` and `vitest` plugins. It is fast and covers script-side rules.
- **ESLint 10 runs second.** It uses `eslint-plugin-vue` (flat/recommended) and `eslint-plugin-vuejs-accessibility` (flat/recommended), with `eslint-plugin-oxlint` turning off the overlapping rules. This is the only working way today to apply eslint-plugin-vue template rules and Vue accessibility lint, which `AGENTS.md` needs.
- **Revisit dropping ESLint** when [oxc#15761](https://github.com/oxc-project/oxc/issues/15761) (Vue template support) lands.
