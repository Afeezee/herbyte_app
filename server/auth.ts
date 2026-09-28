/**
 * Session verification and user resolution.
 *
 * The frontend sends the Clerk session token as `Authorization: Bearer …`. We
 * verify it with @clerk/backend, then look up (and if necessary claim or
 * create) the matching `users` row.
 *
 * Rules from section 5 of the migration prompt:
 * - Imported users have clerk_user_id = null; link by VERIFIED email on first
 *   sign-in.
 * - `role` is never accepted from the client — only bootstrapped from
 *   ADMIN_EMAILS (verified) or flipped by an existing admin through an admin
 *   endpoint (not implemented yet).
 * - The whole app requires sign-in; there is no anonymous read path in the
 *   product.
 */
import { createClerkClient, verifyToken } from "@clerk/backend";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { getEnv } from "./env";
import { users } from "./schema";

export type SessionUser = {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string | null;
  role: "user" | "admin";
  is_seller: boolean;
  seller_profile_id: string | null;
};

let cachedClerk: ReturnType<typeof createClerkClient> | null = null;

function clerk() {
  if (cachedClerk) return cachedClerk;
  const env = getEnv();
  cachedClerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  return cachedClerk;
}

function extractBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export class AuthError extends Error {
  constructor(
    public code:
      | "no_session"
      | "invalid_session"
      | "no_verified_email"
      | "internal",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Verify a Clerk session token from an incoming request. Returns the raw
 * Clerk `sub` (user id) — no DB touch.
 */
export async function verifyClerkToken(
  authorizationHeader: string | null | undefined,
): Promise<{ userId: string }> {
  const token = extractBearer(authorizationHeader);
  if (!token) throw new AuthError("no_session", "Missing Bearer token.");

  const env = getEnv();
  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    if (!payload.sub) {
      throw new AuthError("invalid_session", "Token has no subject.");
    }
    return { userId: payload.sub };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError("invalid_session", "Token verification failed.");
  }
}

/**
 * Resolve the DB user for a verified Clerk id. Creates or claims the row on
 * first sign-in. Claims only by VERIFIED email — an unverified email address
 * on the Clerk user is treated as no email at all for claim purposes.
 */
export async function resolveSessionUser(
  clerkUserId: string,
): Promise<SessionUser> {
  const db = getDb();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerk_user_id, clerkUserId))
    .limit(1);
  if (existing[0]) return toSessionUser(existing[0]);

  const clerkUser = await clerk().users.getUser(clerkUserId);
  const verifiedEmail = clerkUser.emailAddresses.find(
    (e) => e.verification?.status === "verified",
  )?.emailAddress;

  if (!verifiedEmail) {
    throw new AuthError(
      "no_verified_email",
      "Clerk user has no verified email; cannot resolve local user.",
    );
  }
  const email = verifiedEmail.toLowerCase();

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    null;

  // Claim by email if there is a matching row without a clerk_user_id (import
  // path). Otherwise insert.
  const env = getEnv();
  const shouldBeAdmin = env.ADMIN_EMAILS.includes(email);

  const claimed = await db
    .update(users)
    .set({
      clerk_user_id: clerkUserId,
      full_name: fullName,
      // Bump to admin on first login if listed in ADMIN_EMAILS, but never
      // downgrade an existing admin.
      role: shouldBeAdmin ? "admin" : undefined,
      updated_date: sql`now()`,
    })
    .where(sql`${users.clerk_user_id} is null and lower(${users.email}) = ${email}`)
    .returning();

  if (claimed[0]) return toSessionUser(claimed[0]);

  const inserted = await db
    .insert(users)
    .values({
      clerk_user_id: clerkUserId,
      email,
      full_name: fullName,
      role: shouldBeAdmin ? "admin" : "user",
    })
    .returning();

  const row = inserted[0];
  if (!row) throw new AuthError("internal", "Failed to insert user row.");
  return toSessionUser(row);
}

function toSessionUser(row: typeof users.$inferSelect): SessionUser {
  return {
    id: row.id,
    clerk_user_id: row.clerk_user_id ?? "",
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_seller: row.is_seller,
    seller_profile_id: row.seller_profile_id,
  };
}

/**
 * One-call helper for handlers: verify + resolve. Throws AuthError which the
 * router maps to HTTP 401.
 */
export async function requireUser(
  authorizationHeader: string | null | undefined,
): Promise<SessionUser> {
  const { userId } = await verifyClerkToken(authorizationHeader);
  return resolveSessionUser(userId);
}

/**
 * Optional-user helper: returns null instead of throwing when there is no
 * session. Kept for endpoints that behave differently for signed-in vs
 * anonymous callers — currently unused because the whole product requires
 * sign-in, but left available for e.g. public health checks.
 */
export async function optionalUser(
  authorizationHeader: string | null | undefined,
): Promise<SessionUser | null> {
  const token = extractBearer(authorizationHeader);
  if (!token) return null;
  try {
    const { userId } = await verifyClerkToken(authorizationHeader);
    return await resolveSessionUser(userId);
  } catch {
    return null;
  }
}
