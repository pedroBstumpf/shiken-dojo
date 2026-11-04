import { defineConfig } from 'vitest/config';

// Testes das regras de segurança, contra o emulador: `npm run test:rules`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['firebase-tests/**/*.spec.mjs'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
