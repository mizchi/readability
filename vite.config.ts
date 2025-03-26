import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

/// <reference types="vitest" />

export default defineConfig({
  plugins: [
    dts({
      include: "src/**/*.ts",
      exclude: ["src/**/*.test.ts", "v3/test/**", "v3/examples/**"],
    }),
  ],
  build: {
    outDir: "dist",
    lib: {
      entry: "src/index.ts",
      name: "Readability",
      formats: ["es"],
      fileName: () => "index.js",
    },
    target: "esnext",
    sourcemap: true,
    minify: "esbuild",
  },
  test: {
    globals: true,
    environment: "jsdom",
    // test ディレクトリ以下の .js ファイルをテスト対象に含める
    include: ["src/**/*.test.ts", "test/**/*.js"],
    // テスト対象から除外するファイル
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "test/debug-testcase.js",
      "test/generate-testcase.js",
      "test/utils.js",
    ],
  },
});
