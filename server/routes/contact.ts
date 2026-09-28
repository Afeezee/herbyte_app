/**
 * POST /api/contact — public contact form, sends via Resend to CONTACT_TO_EMAIL.
 *
 * Rate-limit-per-IP to stop the form being used as a mail relay. Every
 * message includes the submitter's headers-derived IP for triage.
 *
 * The compat client on the frontend calls this via
 * base44.integrations.Core.SendEmail(payload), which forwards the same
 * shape Base44 accepted.
 */
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { Resend } from "resend";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { getEnv } from "../env";
import { rateLimits } from "../schema";

export const contactRoutes = new Hono();

const CONTACT_LIMIT = { max: 5, windowSeconds: 60 * 60 }; // 5 / IP / hour

const contactSchema = z.object({
  from_name: z.string().min(1).max(200).optional(),
  from: z.string().email().optional(),
  to: z.string().email().optional(), // Ignored — we always deliver to CONTACT_TO_EMAIL
  subject: z.string().min(1).max(200),
  body: z.string().min(5).max(20000),
});

function ipOf(c: Context): string {
  const xff = c.req.header("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || c.req.header("x-real-ip") || "unknown";
}

function ipBucket(now = Date.now(), windowSeconds = CONTACT_LIMIT.windowSeconds): string {
  const size = windowSeconds * 1000;
  return new Date(Math.floor(now / size) * size).toISOString();
}

async function consume(ip: string): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const db = getDb();
  const key = `contact:${ip}`;
  const bucket = ipBucket();
  const [row] = await db
    .insert(rateLimits)
    .values({ key, bucket_start: bucket, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.bucket_start],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  const count = Number(row?.count ?? 0);
  if (count > CONTACT_LIMIT.max) {
    const nextBucket = Date.parse(bucket) + CONTACT_LIMIT.windowSeconds * 1000;
    return { ok: false, retryAfter: Math.max(1, Math.ceil((nextBucket - Date.now()) / 1000)) };
  }
  return { ok: true };
}

contactRoutes.post("/", async (c) => {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    throw new HTTPException(500, {
      message: "RESEND_API_KEY not configured",
      cause: { code: "email_not_configured" },
    });
  }

  const ip = ipOf(c);
  const rl = await consume(ip);
  if (!rl.ok) {
    c.header("Retry-After", String(rl.retryAfter));
    throw new HTTPException(429, {
      message: "Too many messages from this address; try again later.",
      cause: { code: "rate_limited" },
    });
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => i.message).join("; "),
      cause: { code: "invalid_body" },
    });
  }
  const msg = parsed.data;

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Herbyte Contact <contact@herbyte.app>",
    // ^ Must be a domain verified in Resend. Change to your verified sender.
    to: [env.CONTACT_TO_EMAIL],
    replyTo: msg.from ?? undefined,
    subject: msg.subject,
    text:
      `From: ${msg.from_name ?? "Unknown"} <${msg.from ?? "no-email"}>\n` +
      `IP: ${ip}\n\n` +
      `${msg.body}`,
  });

  return c.json({ ok: true });
});
