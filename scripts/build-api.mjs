/**
 * Pre-bundle the Vercel Function's real entry (server/vercel-entry.ts)
 * and its whole server/ import tree into a single api/_bundle.js.
 *
 * Why: Vercel's @vercel/node builder compiles TS in api/ but doesn't
 * traverse into ../server/ to compile shared code — the runtime import
 * of ../server/router fails with ERR_MODULE_NOT_FOUND. Bundling only
 * our own server code (with every node_module left external) sidesteps
 * both that AND the CJS-vs-ESM require() interop that hits undici when
 * bundled. api/index.ts is a permanent stub that re-exports from the
 * bundle.
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const entry = path.join(root, "server", "vercel-entry.ts");
const out = path.join(root, "api", "_bundle.js");

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

// Only inline server/*.ts source. Every third-party dep stays external
// and is resolved from node_modules at runtime, which is what
// @vercel/node already ships.
const external = [
  "node:*",
  ...Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).flatMap(
    (name) => [name, `${name}/*`],
  ),
];

await build({
  entryPoints: [entry],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external,
  minify: false,
  sourcemap: false,
  logLevel: "info",
});
console.log(`✓ bundled → ${path.relative(root, out)}`);
