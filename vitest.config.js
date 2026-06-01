import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
  coverage: {
    provider: 'v8',
    include: ['js/core/**', 'js/data/**', 'js/import/**'],
    exclude: ['js/data/factions/defs*.js'],
    reporter: ['text', 'lcov'],
    thresholds: {
      lines: 72,
      functions: 75,
      branches: 65,
      statements: 72,
    },
  },
});
