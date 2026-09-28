/**
 * Per-user rate limits, independent of the LLM budget ceiling. Section 6.3
 * of the migration prompt sets the exact numbers.
 *
 * Backed by the `rate_limits` table. Uses a fixed-window counter — good
 * enough for these numbers, and simpler than a sliding window under a
 * serverless model.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { rateLimits } from "../schema";

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; message: string };

export type RateLimitPolicy = {
  windowSeconds: number;
  max: number;
  message: string;
};

export const RATE_LIMITS: Record<string, RateLimitPolicy> = {
  "ai-assistant": {
    windowSeconds: 60 * 60,
    max: 20,
    message: "AI assistant limit reached; try again in a bit.",
  },
  "ai-herb-insight": {
    windowSeconds: 60 * 60,
    max: 30,
    message: "Insight limit reached; try again in a bit.",
  },
  "ai-remedy-insight": {
    windowSeconds: 60 * 60,
    max: 30,
    message: "Insight limit reached; try again in a bit.",
  },
  "ai-search-suggestions": {
    windowSeconds: 60 * 60,
    max: 60,
    message: "Search suggestions limit reached.",
  },
  "submissions": {
    windowSeconds: 24 * 60 * 60,
    max: 5,
    message: "Daily submission limit reached.",
  },
};

function bucketStart(windowSeconds: number, now = Date.now()): string {
  const size = windowSeconds * 1000;
  const start = Math.floor(now / size) * size;
  return new Date(start).toISOString();
}

export async function checkAndConsume(
  key: string,
  userEmail: string,
): Promise<RateLimitDecision> {
  const policy = RATE_LIMITS[key];
  if (!policy) return { ok: true }; // Unknown key → no limit
  const db = getDb();
  const bucket = bucketStart(policy.windowSeconds);
  const scoped = `${key}:${userEmail}`;

  // Upsert-then-read approach so it works as a single round trip.
  const [row] = await db
    .insert(rateLimits)
    .values({ key: scoped, bucket_start: bucket, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.bucket_start],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  const count = Number(row?.count ?? 0);
  if (count > policy.max) {
    const nextWindow = Date.parse(bucket) + policy.windowSeconds * 1000;
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((nextWindow - Date.now()) / 1000)),
      message: policy.message,
    };
  }
  return { ok: true };
}
