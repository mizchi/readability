import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'test/**',
        'tests/**',
        '**/__tests__/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/cli.js',
        'src/mcp-server.ts',
        'src/test/**',
        'scripts/**',
      ],
      include: ['src/**/*.ts'],
      all: true,
      clean: true,
      skipFull: false,
      thresholds: {
        lines: 50,
        functions: 60,
        branches: 75,
        statements: 50,
      },
    },
  },
});