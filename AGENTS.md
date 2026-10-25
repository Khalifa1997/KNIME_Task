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
