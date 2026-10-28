import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/support/env.ts'],
    // Os testes de API compartilham um banco real; cada teste cria o próprio dojo.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
