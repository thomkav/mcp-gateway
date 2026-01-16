import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/index.ts',
        '**/types.ts',
      ],
      thresholds: {
        lines: 45,
        functions: 80,
        branches: 80,
        statements: 45,
      },
      // Include all source files for coverage
      all: true,
      include: ['src/**/*.ts'],
    },
  },
});
