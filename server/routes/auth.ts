import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, sql } from "drizzle-orm";
import { Webhook } from "svix";
import { z } from "zod";
import { getDb } from "../db";
import { getEnv } from "../env";
import { users } from "../schema";
import type { Variables } from "../router";

export const authRoutes = new Hono<{ Variables: Variables }>();

/**
 * GET /api/auth/me — return the DB user row for the current session.
 * (The auth middleware already resolved it into c.var.user.)
 */
authRoutes.get("/me", (c) => {
  const u = c.get("user");
  return c.json(toLegacyShape(u));
});

/**
 * PATCH /api/auth/me — narrow self-update. Only these fields are honoured;
 * anything else in the body is dropped on the floor. `role` is NEVER
 * accepted here (F2 in the migration prompt).
 */
const selfUpdateSchema = z
  .object({
    seller_profile_id: z.string().uuid().nullable().optional(),
    is_seller: z.boolean().optional(),
    full_name: z.string().min(1).max(200).optional(),
  })
  .strict();

authRoutes.patch("/me", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = selfUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => i.message).join("; "),
      cause: { code: "invalid_body" },
    });
  }
  const patch = parsed.data;

  // If the caller sets seller_profile_id, verify the row exists and is
  // theirs. Also flip is_seller true when they link a profile; unlink
  // does not automatically drop is_seller — an admin decision.
  if (patch.seller_profile_id) {
    const db = getDb();
    const row = await db.query.sellerProfiles.findFirst({
      where: (t, { eq: e }) => e(t.id, patch.seller_profile_id as string),
    });
    if (!row) {
      throw new HTTPException(404, {
        message: "seller_profile_id does not exist",
        cause: { code: "seller_profile_not_found" },
      });
    }
    if (row.created_by && row.created_by.toLowerCase() !== user.email) {
      throw new HTTPException(403, {
        message: "cannot link a seller profile you did not create",
        cause: { code: "forbidden" },
      });
    }
  }

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({
      seller_profile_id:
        patch.seller_profile_id === undefined
          ? undefined
          : patch.seller_profile_id,
      is_seller: patch.is_seller ?? undefined,
      full_name: patch.full_name ?? undefined,
      updated_date: sql`now()`,
    })
    .where(eq(users.id, user.id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "update failed" });
  }
  return c.json(toLegacyShape(updated));
});

/**
 * Emit a stable user shape so the existing frontend keeps reading
 * `user.role`, `user.email`, `user.full_name`, `user.seller_profile_id`
 * unchanged.
 */
function toLegacyShape(u: typeof users.$inferSelect | ReturnType<Context<{ Variables: Variables }>["get"]>) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    is_seller: u.is_seller,
    seller_profile_id: u.seller_profile_id,
    created_date: "created_date" in u ? u.created_date : undefined,
    updated_date: "updated_date" in u ? u.updated_date : undefined,
  };
}

// ---------------------------------------------------------------------------
// Clerk webhook — keeps the `users` table in sync when the Clerk user is
// created / updated / deleted OUTSIDE the app (e.g. email verified, name
// changed, account deleted). Not required for basic operation (sign-in
// itself upserts through resolveSessionUser), but good hygiene.
// ---------------------------------------------------------------------------

export const clerkWebhook = new Hono();

clerkWebhook.post("/", async (c) => {
  const env = getEnv();
  const secret = env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    throw new HTTPException(500, {
      message: "CLERK_WEBHOOK_SECRET not configured",
    });
  }

  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new HTTPException(400, { message: "Missing svix headers" });
  }

  const payload = await c.req.text();
  let evt: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof evt;
  } catch {
    throw new HTTPException(400, { message: "Invalid webhook signature" });
  }

  const db = getDb();
  const type = evt.type;

  if (type === "user.created" || type === "user.updated") {
    const data = evt.data as {
      id?: string;
      email_addresses?: Array<{
        email_address?: string;
        verification?: { status?: string };
      }>;
      first_name?: string | null;
      last_name?: string | null;
    };
    const clerkUserId = data.id;
    if (!clerkUserId) return c.json({ ok: true });

    const verifiedEmail = data.email_addresses?.find(
      (e) => e.verification?.status === "verified",
    )?.email_address;
    if (!verifiedEmail) return c.json({ ok: true, skipped: "no verified email" });

    const email = verifiedEmail.toLowerCase();
    const fullName =
      [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || null;
    const shouldBeAdmin = env.ADMIN_EMAILS.includes(email);

    // Try to link an existing (imported) user by email, else insert.
    const linked = await db
      .update(users)
      .set({
        clerk_user_id: clerkUserId,
        full_name: fullName,
        role: shouldBeAdmin ? "admin" : undefined,
        updated_date: sql`now()`,
      })
      .where(
        sql`${users.clerk_user_id} is null and lower(${users.email}) = ${email}`,
      )
      .returning({ id: users.id });

    if (linked.length === 0) {
      await db
        .insert(users)
        .values({
          clerk_user_id: clerkUserId,
          email,
          full_name: fullName,
          role: shouldBeAdmin ? "admin" : "user",
        })
        .onConflictDoUpdate({
          target: users.clerk_user_id,
          set: {
            full_name: fullName,
            updated_date: sql`now()`,
          },
        });
    }
    return c.json({ ok: true, action: linked.length ? "linked" : "inserted" });
  }

  if (type === "user.deleted") {
    const clerkUserId = (evt.data as { id?: string }).id;
    if (!clerkUserId) return c.json({ ok: true });
    // Detach the Clerk id; keep the row so their comments/products stay
    // attributed. If you want a full cascade, do it in a dedicated admin
    // flow — this webhook keeps the audit trail intact.
    await db
      .update(users)
      .set({ clerk_user_id: null, updated_date: sql`now()` })
      .where(eq(users.clerk_user_id, clerkUserId));
    return c.json({ ok: true, action: "detached" });
  }

  return c.json({ ok: true, skipped: type });
});
