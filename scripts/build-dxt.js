#!/usr/bin/env node
import * as esbuild from "esbuild";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf8"));

await esbuild.build({
  entryPoints: ["src/run_mcp.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/run_mcp.js",
  minify: true,
  external: [], // Bundle all dependencies
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    "import.meta.vitest": "undefined",
  },
});

console.log("DXT bundle created successfully");
