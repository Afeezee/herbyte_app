/**
 * Diversity planning for the content agent. Reads the DB to see what's
 * already covered, picks a (kind, category, region) tuple that's
 * under-represented, and returns a list of names to avoid when drafting
 * so the LLM doesn't repeat something that already exists.
 */
import { getDb } from "../db";
import { herbs, remedies, herbSubmissions, remedySubmissions } from "../schema";

export const CATEGORIES = [
  "Adaptogen",
  "Anti-inflammatory",
  "Digestive",
  "Immune Support",
  "Cardiovascular",
  "Respiratory",
  "Nervous System",
  "Antimicrobial",
  "Pain Relief",
  "Skin Health",
  "Other",
] as const;

export const REGIONS = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Australia",
  "Middle East",
  "Global",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Region = (typeof REGIONS)[number];

export type DbSnapshot = {
  herbs: Array<{ name: string; category: Category | null; region: Region | null }>;
  remedies: Array<{ name: string; category: Category | null; region: Region | null }>;
};

export async function readDbSnapshot(): Promise<DbSnapshot> {
  const db = getDb();
  const [h, r, hs, rs] = await Promise.all([
    db
      .select({ name: herbs.common_name, category: herbs.category, region: herbs.region })
      .from(herbs),
    db
      .select({ name: remedies.name, category: remedies.category, region: remedies.region })
      .from(remedies),
    db
      .select({
        name: herbSubmissions.common_name,
        category: herbSubmissions.category,
        region: herbSubmissions.region,
      })
      .from(herbSubmissions),
    db
      .select({ name: remedySubmissions.health_condition })
      .from(remedySubmissions),
  ]);

  return {
    herbs: [...h, ...hs].map((x) => ({
      name: x.name,
      category: x.category as Category | null,
      region: x.region as Region | null,
    })),
    remedies: [
      ...r.map((x) => ({
        name: x.name,
        category: x.category as Category | null,
        region: x.region as Region | null,
      })),
      // Remedy submissions carry health_condition instead of
      // category/region on the row (taxonomy lives in draft_payload
      // after enrichment); we track them by health_condition so the
      // agent doesn't repeat recent ailments.
      ...rs.map((x) => ({ name: x.name, category: null, region: null })),
    ],
  };
}

export type Plan = {
  kind: "herb" | "remedy";
  category: Category;
  region: Region;
};

/**
 * Pick a (kind, category, region) that is UNDER-represented.
 * 1. Alternate kind by DB-count parity so herbs and remedies grow together.
 * 2. Pick the least-represented category for that kind.
 * 3. Pick the least-represented region for that kind within that category.
 * 4. Give West Africa a small nudge so the brief's region bias comes through.
 */
export function chooseNextPlan(snapshot: DbSnapshot): Plan {
  const kind: "herb" | "remedy" =
    snapshot.herbs.length <= snapshot.remedies.length ? "herb" : "remedy";
  const items = kind === "herb" ? snapshot.herbs : snapshot.remedies;

  const categoryCounts = new Map<Category, number>();
  for (const c of CATEGORIES) categoryCounts.set(c, 0);
  for (const item of items) {
    if (item.category) categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }
  const category = minKey(categoryCounts);

  const regionCounts = new Map<Region, number>();
  for (const r of REGIONS) regionCounts.set(r, 0);
  for (const item of items) {
    if (item.category === category && item.region) {
      regionCounts.set(item.region, (regionCounts.get(item.region) ?? 0) + 1);
    }
  }
  // Nudge toward Africa a bit — the brief emphasises West African medicine.
  regionCounts.set("Africa", (regionCounts.get("Africa") ?? 0) - 0.25);
  const region = minKey(regionCounts);

  return { kind, category, region };
}

function minKey<T>(m: Map<T, number>): T {
  let best: T | null = null;
  let bestCount = Infinity;
  for (const [k, v] of m) {
    if (v < bestCount) {
      bestCount = v;
      best = k;
    }
  }
  if (best === null) throw new Error("no categories/regions configured");
  return best;
}

export function knownNames(snapshot: DbSnapshot, kind: "herb" | "remedy"): string[] {
  const names = kind === "herb" ? snapshot.herbs.map((h) => h.name) : snapshot.remedies.map((r) => r.name);
  return [...new Set(names)];
}
