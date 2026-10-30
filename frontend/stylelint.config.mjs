// CSS has one rule: sizes are rem, never px (see AGENTS.md). Everything else is left to ESLint and review.
export default {
  overrides: [{ files: ['**/*.vue'], customSyntax: 'postcss-html' }],
  rules: {
    'declaration-property-unit-disallowed-list': [
      // Every property except 1px/2px lines: borders, outlines and shadows (the focus ring).
      { '/^(?!border(-(top|right|bottom|left))?(-width)?$|outline|box-shadow|--focus-ring$)/': ['px'] },
      { message: 'Use rem, not px (AGENTS.md rule 7).' },
    ],
  },
}
