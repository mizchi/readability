import { defineConfig } from 'tsdown'

export default defineConfig([
  // Library build (replacing vite)
  {
    entry: ['src/index.ts'],
    format: 'esm',
    target: 'esnext',
    external: ['htmlparser2'],
    clean: true,
    outDir: 'dist',
    bundle: true,
    minify: true,
    platform: 'neutral',
    sourcemap: true,
    dts: true,
  },
  // MCP server bundle
  {
    entry: ['src/mcp.ts'],
    format: 'esm',
    target: 'node20',
    external: [],
    clean: false,
    outDir: 'dist',
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
  },
  // DXT entry point
  {
    entry: ['src/run_mcp.ts'],
    format: 'esm',
    target: 'node20',
    external: [],
    clean: false,
    outDir: 'dist',
    bundle: true,
    minify: true,
    platform: 'node',
    esbuild: {
      banner: {
        js: '#!/usr/bin/env node',
      },
    },
  },
])