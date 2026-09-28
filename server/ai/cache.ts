import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { aiResponseCache } from "../schema";

const DEFAULT_TTL_SECONDS = 60 * 60 * 6; // 6 hours

export function hashInput(...parts: unknown[]): string {
  const h = createHash("sha256");
  h.update(parts.map((p) => JSON.stringify(p)).join("\n"));
  return h.digest("hex");
}

export async function readCache<T>(
  endpoint: string,
  inputHash: string,
): Promise<T | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(aiResponseCache)
    .where(
      and(
        eq(aiResponseCache.endpoint, endpoint),
        eq(aiResponseCache.input_hash, inputHash),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.response as T;
}

export async function writeCache(
  endpoint: string,
  inputHash: string,
  response: unknown,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db
    .insert(aiResponseCache)
    .values({
      endpoint,
      input_hash: inputHash,
      response: response as never,
      expires_at: expiresAt,
    })
    .onConflictDoUpdate({
      target: [aiResponseCache.endpoint, aiResponseCache.input_hash],
      set: {
        response: response as never,
        expires_at: expiresAt,
      },
    });
}

/** Purge expired rows — call from cron or eagerly on cache miss. */
export async function purgeExpiredCache(): Promise<number> {
  const db = getDb();
  const res = await db
    .delete(aiResponseCache)
    .where(sql`${aiResponseCache.expires_at} < now()`);
  return (res as unknown as { rowCount?: number }).rowCount ?? 0;
}
