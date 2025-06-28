import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['mcp.ts'],
  format: 'esm',
  target: 'node20',
  external: [],
  clean: true,
  outDir: 'dist-mcp',
  bundle: true,
  minify: true,
  platform: 'node',
  define: {
    'import.meta.vitest': 'undefined',
  },
  esbuild: {
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
})