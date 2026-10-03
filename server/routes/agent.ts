/**
 * Content-agent cron endpoint.
 *
 * POST /api/cron/run-agent?n=6
 *
 * Vercel Cron hits this on schedule; a shared CRON_SECRET header
 * authenticates the call. The handler drives the agent runner, which
 * submits via app.fetch in-process (no outbound HTTP) carrying the
 * same AGENT_SERVICE_TOKEN the CLI would use.
 *
 * Hobby-plan sizing: 2 crons / day × n=6 posts each = 12 posts/day,
 * matching the AGENT_DAILY_CAP default. The runner re-reads the DB
 * counter between posts so overlapping invocations can't overshoot.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getEnv } from "../env";
import { runAgentBatch, type SubmitFn } from "../agent/runner";
import type { Hono as HonoApp } from "hono";

export function makeAgentCronRoutes(appFetch: HonoApp["fetch"]) {
  const r = new Hono();

  // Vercel Cron always fires GET requests (not configurable), so the
  // same handler is exposed for GET and POST — GET for the scheduler,
  // POST for manual curl / local testing.
  r.on(["GET", "POST"], "/run-agent", async (c) => {
    const env = getEnv();
    if (!env.CRON_SECRET) {
      throw new HTTPException(500, { message: "CRON_SECRET not configured" });
    }
    // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
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

    const submit: SubmitFn = async (path, body) => {
      const req = new Request(`${url.origin}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agent-service-token": env.AGENT_SERVICE_TOKEN!,
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

    const report = await runAgentBatch(n, { submit });
    return c.json(report);
  });

  return r;
}
