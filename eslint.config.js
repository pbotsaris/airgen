// ESLint 10 flat config. Lints the TypeScript client (src/client), the
// uncompiled daemon (src/daemon), the bin, the tests, and the examples.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    // packages/ui (vitest + its tsconfigs) and the sandbox extension run their
    // own toolchains and are not linted from the root.
    ignores: [
      'dist/',
      'node_modules/',
      'packages/',
      'sandbox/',
      'plan/',
      'coverage/',
      'test/fixtures/snapshots/',
      'examples/airtable-schema.ts',
    ],
  },
  js.configs.recommended,
  // Node-side plain ESM (daemon, bin, tests, config files).
  {
    files: ['src/daemon/**/*.js', 'bin/**/*.js', 'test/**/*.js', 'scripts/**/*.{js,mjs}', '*.config.{js,ts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {...globals.node},
    },
    rules: {
      'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrors: 'none'}],
    },
  },
  // Browser-side TypeScript (runs in the extension iframe), and the examples
  // written against it (typechecked by generator.test.js, never shipped).
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['src/client/**/*.{ts,tsx}', 'examples/**/*.{ts,tsx}'],
  })),
  {
    files: ['src/client/**/*.{ts,tsx}', 'examples/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {...globals.browser},
    },
    plugins: {'react-hooks': reactHooks},
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrors: 'none'}],
      // `getCellValue(field: any)` and friends are deliberate: the structural
      // SDK types in sdk.ts use `any` where the real SDK parameter is a class
      // union that would otherwise fail strictFunctionTypes (documented inline).
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // The ambient module declarations for the experimental SDK are compile-time only.
  {
    files: ['src/client/**/*.d.ts'],
    rules: {'@typescript-eslint/no-unused-vars': 'off'},
  },
  prettier,
);
