/**
 * Daily cap for the content agent — counts the agent's submissions in
 * the DB rather than a file, so the limit holds across any invocation
 * path (local CLI, Vercel Cron, GitHub Actions, manual re-runs).
 *
 * "Today" is UTC. Both herb_submissions and remedy_submissions are
 * counted since the cap is total, not per-kind.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { herbSubmissions, remedySubmissions } from "../schema";

function todayUtcStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function countAgentSubmissionsToday(agentEmail: string): Promise<number> {
  const db = getDb();
  const email = agentEmail.toLowerCase();
  const since = todayUtcStart();

  const herbRows = (await db
    .select({ c: sql<number>`count(*)::int` })
    .from(herbSubmissions)
    .where(
      and(
        eq(herbSubmissions.created_by, email),
        gte(herbSubmissions.created_date, since),
      ),
    )) as unknown as Array<{ c: number }>;

  const remedyRows = (await db
    .select({ c: sql<number>`count(*)::int` })
    .from(remedySubmissions)
    .where(
      and(
        eq(remedySubmissions.created_by, email),
        gte(remedySubmissions.created_date, since),
      ),
    )) as unknown as Array<{ c: number }>;

  return Number(herbRows[0]?.c ?? 0) + Number(remedyRows[0]?.c ?? 0);
}
