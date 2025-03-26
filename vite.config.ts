import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

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
});
