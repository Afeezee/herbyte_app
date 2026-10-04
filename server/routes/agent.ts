/**
 * Content-agent HTTP endpoints.
 *
 * Two surfaces:
 *   GET /POST /api/cron/run-agent?n=<N>
 *     — Vercel Cron fires this on schedule; CRON_SECRET auth.
 *   POST /api/agent/run
 *     — admin dashboard trigger; Clerk session + role=admin auth
 *       (enforced one level up by the shared auth middleware + the
 *       requireAdmin check here).
 *
 * Both share the same submit() closure and runAgentBatch(), so the
 * generation path is identical regardless of trigger.
 */
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getEnv } from "../env";
import { runAgentBatch, type SubmitFn } from "../agent/runner";
import type { Hono as HonoApp } from "hono";
import type { Variables } from "../router";

/** Returns a SubmitFn that POSTs to our own /api/submissions/* via app.fetch (in-process). */
function makeInProcessSubmit(appFetch: HonoApp["fetch"], origin: string, serviceToken: string): SubmitFn {
  return async (path, body) => {
    const req = new Request(`${origin}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-service-token": serviceToken,
        authorization: "Bearer agent",
      },
      body: JSON.stringify(body),
    });
    const res = await appFetch(req);
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string } }).error;
      return { ok: false, status: res.status, message: err?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: data as { id?: string; moderation_status?: string } };
  };
}

// ---------------------------------------------------------------------------
// Cron entry (CRON_SECRET auth)
// ---------------------------------------------------------------------------

export function makeAgentCronRoutes(appFetch: HonoApp["fetch"]) {
  const r = new Hono();

  // Vercel Cron fires GET; manual tests send POST.
  r.on(["GET", "POST"], "/run-agent", async (c) => {
    const env = getEnv();
    if (!env.CRON_SECRET) {
      throw new HTTPException(500, { message: "CRON_SECRET not configured" });
    }
    const auth = c.req.header("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    if (!env.AGENT_SERVICE_TOKEN) {
      throw new HTTPException(500, { message: "AGENT_SERVICE_TOKEN not configured" });
    }

    const url = new URL(c.req.url);
    const nParam = Number(url.searchParams.get("n") ?? "6");
    const n = Number.isFinite(nParam) && nParam > 0 ? Math.floor(nParam) : 6;

    const submit = makeInProcessSubmit(appFetch, url.origin, env.AGENT_SERVICE_TOKEN);
    const report = await runAgentBatch(n, { submit });
    return c.json(report);
  });

  return r;
}

// ---------------------------------------------------------------------------
// Admin trigger (Clerk session + role=admin)
// ---------------------------------------------------------------------------

const REGIONS = [
  "Africa", "Asia", "Europe", "North America",
  "South America", "Australia", "Middle East", "Global",
] as const;

const adminRunSchema = z.object({
  n: z.number().int().min(1).max(12).default(1),
  kind: z.enum(["random", "herb", "remedy"]).default("random"),
  research: z.enum(["random", "force", "skip"]).default("random"),
  draftOnly: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  /** Pin a specific herb — forces primary_herb_name (remedy) or common_name (herb). */
  targetHerb: z.string().trim().max(120).optional(),
  /** Pin a specific region — overrides diversity pick. */
  targetRegion: z.enum(REGIONS).optional(),
});

function requireAdmin(c: Context<{ Variables: Variables }>) {
  const u = c.get("user");
  if (u.role !== "admin") {
    throw new HTTPException(403, { message: "Admin only", cause: { code: "forbidden" } });
  }
  return u;
}

export function makeAgentAdminRoutes(appFetch: HonoApp["fetch"]) {
  const r = new Hono<{ Variables: Variables }>();

  r.post("/run", async (c) => {
    requireAdmin(c);
    const env = getEnv();
    if (!env.AGENT_SERVICE_TOKEN) {
      throw new HTTPException(500, { message: "AGENT_SERVICE_TOKEN not configured" });
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = adminRunSchema.safeParse(body);
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: parsed.error.issues.map((i) => i.message).join("; "),
        cause: { code: "invalid_body" },
      });
    }
    const opts = parsed.data;

    const url = new URL(c.req.url);
    const submit = makeInProcessSubmit(appFetch, url.origin, env.AGENT_SERVICE_TOKEN);

    const report = await runAgentBatch(opts.n, {
      submit,
      forceKind: opts.kind === "random" ? undefined : opts.kind,
      forceResearch: opts.research === "force",
      skipResearch: opts.research === "skip",
      draftOnly: opts.draftOnly,
      dryRun: opts.dryRun,
      targetHerb: opts.targetHerb || null,
      targetRegion: opts.targetRegion ?? null,
    });
    return c.json(report);
  });

  return r;
}
