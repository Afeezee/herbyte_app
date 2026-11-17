import { Hono, type Context, type Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { AuthError, optionalUser, requireUser, type SessionUser } from "./auth";
import { getEnv } from "./env";
import { authRoutes, clerkWebhook } from "./routes/auth";
import { entitiesRoutes } from "./routes/entities";
import { aiRoutes } from "./routes/ai";
import { submissionRoutes } from "./routes/submissions";
import { uploadRoutes } from "./routes/upload";
import { contactRoutes } from "./routes/contact";
import { makeAgentAdminRoutes, makeAgentCronRoutes } from "./routes/agent";
import { regenerateRoutes } from "./routes/regenerate";

// -----------------------------------------------------------------------------
// Response shape stays JSON with {error:{code,message}} on failure —
// on failure. Handlers throw HTTPException; a global error handler maps them.
// -----------------------------------------------------------------------------

// Default variables — non-null `user` because all routes except the
// public-entity GETs go through `requireAuthMiddleware`.
// The entities router uses its own `EntitiesVariables` to express that
// `user` may be null on anonymous GET.
export type Variables = { user: SessionUser };
export type EntitiesVariables = { user: SessionUser | null };

// Entity names that accept anonymous GET (list + single). The policy
// layer still decides which rows to return — see `readFilter(user)`.
const PUBLIC_READABLE_ENTITIES = new Set<string>([
  "Herb",
  "Remedy",
  "Product",
  "Event",
  "SellerProfile",
]);

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

// GET on /api/entities/<PublicReadable> accepts anonymous callers (user
// may be null, policies filter rows accordingly). Everything else under
// /api/entities requires auth. Both branches populate c.var.user (possibly
// null for the optional one).
app.use("/api/entities/*", entitiesAuthMiddleware);
app.use("/api/auth/me", requireAuthMiddleware);
app.use("/api/upload", requireAuthMiddleware);
app.use("/api/ai/*", requireAuthMiddleware);
app.use("/api/submissions/*", requireAuthMiddleware);
app.use("/api/regenerate/*", requireAuthMiddleware);
app.use("/api/agent/*", requireAuthMiddleware);

async function requireAuthMiddleware(
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

async function entitiesAuthMiddleware(
  c: Context<{ Variables: EntitiesVariables }>,
  next: Next,
) {
  // Path layout is /api/entities/:name[/:id]. Pull :name.
  const parts = new URL(c.req.url).pathname.split("/").filter(Boolean);
  // ["api","entities",":name", ...]
  const name = parts[2] ?? "";
  const method = c.req.method.toUpperCase();
  const isPublicGet = method === "GET" && PUBLIC_READABLE_ENTITIES.has(name);

  if (!isPublicGet) {
    // requireAuth narrows user to non-null; cast across the Variables
    // divergence (user: SessionUser vs SessionUser|null) — runtime
    // semantics are identical, just keyed on the same `user` slot.
    return requireAuthMiddleware(c as unknown as Context<{ Variables: Variables }>, next);
  }

  // Anonymous allowed — populate user if a bearer was supplied, but
  // never fail the request if it wasn't.
  const user = await optionalUser(c.req.header("authorization"));
  c.set("user", user);
  await next();
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

// Cron: content agent — hit by Vercel Cron (see vercel.json), auth
// by CRON_SECRET. Admin dashboard trigger lives at /api/agent/run.
// Both pass app.fetch so submission POSTs stay in-process.
app.route("/api/cron", makeAgentCronRoutes(app.fetch.bind(app)));
app.route("/api/agent", makeAgentAdminRoutes(app.fetch.bind(app)));

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
