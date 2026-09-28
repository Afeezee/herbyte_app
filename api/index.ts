/**
 * Vercel Function entry point. All /api/* traffic hits this file via the
 * rewrite in vercel.json.
 *
 * Hono ships an adapter for the Vercel Edge/Node runtime, but the default
 * Node runtime works fine with `handle` from `hono/vercel`.
 */
import { handle } from "hono/vercel";
import { app } from "../server/router";

export const config = { runtime: "nodejs" };

export default handle(app);
