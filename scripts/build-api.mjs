/**
 * Pre-bundle the Vercel Function's real entry (server/vercel-entry.ts)
 * and its whole server/ import tree into a single api/_bundle.js.
 *
 * Why: Vercel's @vercel/node builder compiles TS in api/ but doesn't
 * traverse into ../server/ to compile shared code — the runtime import
 * of ../server/router fails with ERR_MODULE_NOT_FOUND. Bundling
 * everything into one file sidesteps that. api/index.ts is a permanent
 * stub that re-exports from the bundle.
 */
import { build } from "esbuild";
import path from "node:path";

const root = process.cwd();
const entry = path.join(root, "server", "vercel-entry.ts");
const out = path.join(root, "api", "_bundle.js");

// Node built-ins only. Everything else — hono, drizzle, @clerk/backend,
// @neondatabase/serverless, svix, resend, zod, @vercel/blob — gets
// bundled so the deployed function is self-contained.
const external = [
  "node:*",
  // Optional native/global-only deps we don't use, but a transitive
  // pull-in shouldn't fail the bundle.
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
