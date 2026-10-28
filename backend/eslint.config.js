// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['dist/', 'coverage/', '.local/'] },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      // catch {} vazio é proibido (BACKEND.md §15).
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
]);
