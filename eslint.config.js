import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'dist-web/', 'node_modules/', 'coverage/', 'tests/fixtures/', 'spike/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The service worker runs in a worker global scope, not the page.
    files: ['public-web/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Promise: 'readonly',
      },
    },
  },
  {
    // Build tooling runs in Node, not in the browser bundle.
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly' },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Both fail under file:// (research R2). Banned so a regression cannot ship.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Dynamic import() fails under file://. Use a static import.',
        },
        {
          selector: "NewExpression[callee.name='Worker']",
          message: 'Web Workers cannot be constructed from file://. Keep work on the main thread.',
        },
      ],
    },
  },
);
