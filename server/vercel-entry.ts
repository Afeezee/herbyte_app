/**
 * The real Vercel Function entry — kept under server/ (not api/) so the
 * build script can bundle it and its whole import tree into a single
 * api/_bundle.js. See scripts/build-api.mjs.
 *
 * api/index.ts (the file Vercel actually calls) is a thin re-export
 * from the built bundle.
 */
import { handle } from "hono/vercel";
import { app } from "./router";

export const config = { runtime: "nodejs" };

export default handle(app);
