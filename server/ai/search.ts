/**
 * Web-search grounding — Serper primary, Tavily fallback. Fills the gap
 * Base44's `add_context_from_internet` used to provide: real URLs to hand
 * the model, then filtered server-side against the returned reference list
 * so we never trust a hallucinated citation.
 *
 * Section 6.4 of the migration prompt: Serper gives a one-time 2,500-query
 * credit; Tavily gives 1,000/month. We ledger both in `search_usage` and
 * fail over on 402/quota.
 */
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "../db";
import { getEnv } from "../env";
import {
  searchResponseCache,
  searchUsage,
} from "../schema";

export type SearchResult = { title: string; url: string; snippet: string };
export type SearchOutcome = {
  results: SearchResult[];
  provider: "serper" | "tavily" | "cache";
};

function todayBucket(now = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function hashQuery(query: string): string {
  return createHash("sha256").update(query.trim().toLowerCase()).digest("hex");
}

async function checkDailyBudget(provider: string): Promise<boolean> {
  const env = getEnv();
  const db = getDb();
  const day = todayBucket();
  const [row] = await db
    .select({
      requests: sql<number>`coalesce(sum(${searchUsage.requests}), 0)`,
    })
    .from(searchUsage)
    .where(
      and(eq(searchUsage.bucket_day, day), eq(searchUsage.provider, provider)),
    );
  const used = Number(row?.requests ?? 0);
  return used < env.SEARCH_DAILY_CEILING;
}

async function bumpUsage(provider: string): Promise<void> {
  const db = getDb();
  await db.insert(searchUsage).values({
    provider,
    bucket_day: todayBucket(),
    requests: 1,
  });
}

async function readCache(hash: string): Promise<SearchResult[] | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(searchResponseCache)
    .where(eq(searchResponseCache.query_hash, hash))
    .limit(1);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.results as SearchResult[];
}

async function writeCache(hash: string, provider: string, results: SearchResult[]) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(); // 6h
  await db
    .insert(searchResponseCache)
    .values({ query_hash: hash, provider, results: results as never, expires_at: expiresAt })
    .onConflictDoUpdate({
      target: searchResponseCache.query_hash,
      set: { provider, results: results as never, expires_at: expiresAt },
    });
}

async function serper(query: string): Promise<SearchResult[]> {
  const env = getEnv();
  if (!env.SERPER_API_KEY) throw new Error("SERPER_API_KEY not set");
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });
  if (!res.ok) {
    const err = new Error(`Serper HTTP ${res.status}`);
    (err as unknown as { status: number }).status = res.status;
    throw err;
  }
  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (data.organic ?? [])
    .slice(0, 5)
    .filter((r): r is { title: string; link: string; snippet?: string } => !!r.link && !!r.title)
    .map((r) => ({ title: r.title, url: r.link, snippet: r.snippet ?? "" }));
}

async function tavily(query: string): Promise<SearchResult[]> {
  const env = getEnv();
  if (!env.TAVILY_API_KEY) throw new Error("TAVILY_API_KEY not set");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results ?? [])
    .slice(0, 5)
    .filter((r): r is { title: string; url: string; content?: string } => !!r.url && !!r.title)
    .map((r) => ({ title: r.title, url: r.url, snippet: r.content ?? "" }));
}

/**
 * Search with cache + provider fallback + usage ledger. Never throws —
 * returns an empty result set on total failure so the caller can degrade
 * gracefully.
 */
export async function search(query: string): Promise<SearchOutcome> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], provider: "cache" };

  const hash = hashQuery(trimmed);
  const cached = await readCache(hash);
  if (cached) return { results: cached, provider: "cache" };

  const env = getEnv();

  // Serper first when available and under budget.
  if (env.SERPER_API_KEY && (await checkDailyBudget("serper"))) {
    try {
      const results = await serper(trimmed);
      await bumpUsage("serper");
      await writeCache(hash, "serper", results);
      return { results, provider: "serper" };
    } catch (err) {
      const status = (err as { status?: number }).status;
      // 402/quota → fall through to Tavily
      if (status !== 402 && status !== 429) {
        // For other errors, still try Tavily rather than fail outright.
      }
    }
  }

  if (env.TAVILY_API_KEY && (await checkDailyBudget("tavily"))) {
    try {
      const results = await tavily(trimmed);
      await bumpUsage("tavily");
      await writeCache(hash, "tavily", results);
      return { results, provider: "tavily" };
    } catch {
      // fall through
    }
  }

  return { results: [], provider: "cache" };
}

/**
 * Filter a model-generated reference list to only URLs that were actually
 * present in the supplied search results. This is the server-side guard
 * against hallucinated citations (F4 in the migration prompt).
 */
export function filterCitedReferences<
  T extends { url?: string | null },
>(references: T[], search: SearchResult[]): T[] {
  const allow = new Set(
    search
      .map((r) => normalizeUrl(r.url))
      .filter((u): u is string => !!u),
  );
  return references.filter((r) => {
    const u = normalizeUrl(r.url ?? "");
    return !!u && allow.has(u);
  });
}

function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Ignore tracking params — canonical hostname + pathname is enough.
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}
