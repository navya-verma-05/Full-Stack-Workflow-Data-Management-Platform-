import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
    },
  },
});

