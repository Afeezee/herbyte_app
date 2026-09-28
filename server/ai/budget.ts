/**
 * Postgres-backed LLM budget ledger. Serverless functions have no shared
 * memory, so we cannot keep in-process counters — every check reads/writes
 * the `llm_usage` table.
 *
 * Guardrails:
 * - Requests-per-minute (RPM), tokens-per-minute (TPM), tokens-per-day (TPD)
 *   against soft ceilings from env (GROQ_RPM_CEILING, GROQ_TPM_CEILING,
 *   GROQ_TPD_CEILING) — set well below Groq's published free-tier limits.
 * - `reserveBudget` returns { ok: true } iff there is room for a call at
 *   this instant; the caller records the actual token cost afterwards with
 *   `recordUsage`. This is optimistic — a burst of parallel invocations
 *   can briefly exceed the ceiling — but the ceilings are set with headroom
 *   for that.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { getEnv } from "../env";
import { llmUsage } from "../schema";

export type BudgetDecision =
  | { ok: true }
  | { ok: false; code: "rpm" | "tpm" | "tpd"; retryAfterSeconds: number };

function minuteBucket(now = new Date()): string {
  const d = new Date(now);
  d.setUTCSeconds(0, 0);
  return d.toISOString();
}
function dayBucket(now = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function reserveBudget(estTokens: number): Promise<BudgetDecision> {
  const env = getEnv();
  const db = getDb();
  const now = new Date();
  const minute = minuteBucket(now);
  const day = dayBucket(now);

  const [minuteRow] = await db
    .select({
      requests: sql<number>`coalesce(sum(${llmUsage.requests}), 0)`,
      tokens: sql<number>`coalesce(sum(${llmUsage.input_tokens} + ${llmUsage.output_tokens}), 0)`,
    })
    .from(llmUsage)
    .where(eq(llmUsage.bucket_minute, minute));

  const requestsThisMinute = Number(minuteRow?.requests ?? 0);
  const tokensThisMinute = Number(minuteRow?.tokens ?? 0);

  if (requestsThisMinute >= env.GROQ_RPM_CEILING) {
    return { ok: false, code: "rpm", retryAfterSeconds: secondsUntilNextMinute(now) };
  }
  if (tokensThisMinute + estTokens > env.GROQ_TPM_CEILING) {
    return { ok: false, code: "tpm", retryAfterSeconds: secondsUntilNextMinute(now) };
  }

  const [dayRow] = await db
    .select({
      tokens: sql<number>`coalesce(sum(${llmUsage.input_tokens} + ${llmUsage.output_tokens}), 0)`,
    })
    .from(llmUsage)
    .where(eq(llmUsage.bucket_day, day));

  const tokensToday = Number(dayRow?.tokens ?? 0);
  if (tokensToday + estTokens > env.GROQ_TPD_CEILING) {
    return { ok: false, code: "tpd", retryAfterSeconds: secondsUntilNextDay(now) };
  }

  return { ok: true };
}

export async function recordUsage(params: {
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const db = getDb();
  const now = new Date();
  await db.insert(llmUsage).values({
    endpoint: params.endpoint,
    model: params.model,
    bucket_minute: minuteBucket(now),
    bucket_day: dayBucket(now),
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    requests: 1,
  });
}

function secondsUntilNextMinute(now: Date): number {
  const next = new Date(now);
  next.setUTCSeconds(60, 0);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function secondsUntilNextDay(now: Date): number {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return Math.max(60, Math.ceil((next.getTime() - now.getTime()) / 1000));
}
