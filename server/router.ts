import { Hono, type Context, type Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { AuthError, requireUser, type SessionUser } from "./auth";
import { getEnv } from "./env";
import { authRoutes, clerkWebhook } from "./routes/auth";
import { entitiesRoutes } from "./routes/entities";
import { aiRoutes } from "./routes/ai";
import { submissionRoutes } from "./routes/submissions";
import { uploadRoutes } from "./routes/upload";
import { contactRoutes } from "./routes/contact";
import { makeAgentCronRoutes } from "./routes/agent";
import { regenerateRoutes } from "./routes/regenerate";

// -----------------------------------------------------------------------------
// Response shape stays JSON with {error:{code,message}} on failure —
// on failure. Handlers throw HTTPException; a global error handler maps them.
// -----------------------------------------------------------------------------

export type Variables = { user: SessionUser };

export const app = new Hono<{ Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);

// Health check — no auth. Confirms env parses.
app.get("/api/health", (c) => {
  try {
    getEnv();
    return c.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return c.json({ ok: false, error: msg }, 500);
  }
});

// -----------------------------------------------------------------------------
// Auth middleware — populates c.var.user for anything under /api/entities,
// /api/auth/me, /api/upload, /api/ai/*, /api/submissions/*.
// -----------------------------------------------------------------------------

app.use("/api/entities/*", authMiddleware);
app.use("/api/auth/me", authMiddleware);
app.use("/api/upload", authMiddleware);
app.use("/api/ai/*", authMiddleware);
app.use("/api/submissions/*", authMiddleware);
app.use("/api/regenerate/*", authMiddleware);

async function authMiddleware(
  c: Context<{ Variables: Variables }>,
  next: Next,
) {
  try {
    const user = await requireUser(
      c.req.header("authorization"),
      c.req.header("x-agent-service-token"),
    );
    c.set("user", user);
    await next();
  } catch (err) {
    if (err instanceof AuthError) {
      throw new HTTPException(401, {
        message: err.message,
        cause: { code: err.code },
      });
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Route placeholders — implemented in phases 2–6.
// -----------------------------------------------------------------------------

// Phase 2 — auth self endpoints
app.route("/api/auth", authRoutes);

// Clerk webhook (svix-signed, no session)
app.route("/api/webhooks/clerk", clerkWebhook);

// Phase 3 — generic entity CRUD
app.route("/api/entities", entitiesRoutes);

// Phase 4 — AI advice endpoints
app.route("/api/ai", aiRoutes);

// Phase 5 — submission pipeline
app.route("/api/submissions", submissionRoutes);

// Regenerate agent-generated herb/remedy fields on demand (admin only).
app.route("/api/regenerate", regenerateRoutes);

// Phase 6 — uploads + contact form
app.route("/api/upload", uploadRoutes);
app.route("/api/contact", contactRoutes);

// Cron: content agent — hit twice a day by Vercel Cron (see vercel.json).
// Takes `?n=6` to post 6 submissions per invocation, giving 12/day with
// two crons. app.fetch is passed in so submission POSTs stay in-process.
app.route("/api/cron", makeAgentCronRoutes(app.fetch.bind(app)));

// -----------------------------------------------------------------------------
// 404 + error handler — the SDK expects `{error: {code, message}}`.
// -----------------------------------------------------------------------------

app.notFound((c) => {
  return c.json({ error: { code: "not_found", message: "Route not found" } }, 404);
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const cause = (err.cause ?? {}) as { code?: string };
    return c.json(
      {
        error: {
          code: cause.code ?? httpCodeToCode(err.status),
          message: err.message,
        },
      },
      err.status,
    );
  }
  console.error("[api]", err);
  return c.json(
    { error: { code: "internal", message: "Internal server error" } },
    500,
  );
});

function httpCodeToCode(status: number): string {
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 501) return "not_implemented";
  return "error";
}
