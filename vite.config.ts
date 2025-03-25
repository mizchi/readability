import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: 'v3/**/*.ts',
      exclude: ['v3/**/*.test.ts', 'v3/test/**', 'v3/examples/**'],

    }),
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: 'v3/index.ts',
      name: 'Readability',
      formats: ['es'],
      fileName: () => 'dist.js',
    },
    target: 'esnext',
    sourcemap: true,
    minify: 'esbuild',
  },
});
