// ESLint flat config for the Pixel Race monorepo.
// Covers TypeScript across all workspaces; Prettier owns formatting.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Paths ESLint should never lint.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'aidlc/**',
      '.kiro/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    // Config files run in Node and may use CommonJS-ish globals.
    files: ['**/*.config.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Disable formatting rules that conflict with Prettier. Keep last.
  prettier,
);
