/**
 * Diversity planning for the content agent. Reads the DB to see what's
 * already covered, picks a (kind, category, region) tuple that's
 * under-represented, and returns a list of names to avoid when drafting
 * so the LLM doesn't repeat something that already exists.
 */
import { getDb } from "../db";
import { herbs, remedies, herbSubmissions, remedySubmissions } from "../schema";
import { sql } from "drizzle-orm";

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

/**
 * Specific health conditions people actually search for. The planner
 * picks one of these as the remedy target rather than letting the LLM
 * default to the first category in the enum (which was always
 * "Adaptogen" and caused the whole queue to drift into adaptogens).
 *
 * Keep broad and non-prescriptive — downstream AI moderation decides
 * whether a given remedy for a given condition is safe to publish.
 */
export const HEALTH_CONDITIONS = [
  // Metabolic / endocrine
  "weight loss and obesity",
  "fatty liver disease",
  "type 2 diabetes and blood sugar",
  "high cholesterol",
  "thyroid support",
  "PCOS and hormonal balance",
  "menopausal symptoms",
  // Cardiovascular
  "high blood pressure",
  "poor circulation",
  "varicose veins",
  // Kidneys / urinary
  "kidney stones",
  "urinary tract infections",
  "water retention",
  // Skin
  "acne",
  "eczema",
  "psoriasis",
  "hair loss and thinning",
  "wound healing",
  // Eyes
  "dry eyes and eye strain",
  "age-related macular support",
  // Bones / joints
  "osteoporosis and bone density",
  "arthritis and joint stiffness",
  "back pain and sciatica",
  "muscle recovery and soreness",
  // Digestive
  "acid reflux and heartburn",
  "constipation",
  "bloating and gas",
  "irritable bowel symptoms",
  "nausea",
  "parasites and gut cleanse",
  // Respiratory
  "cough and bronchitis",
  "asthma support",
  "sinus congestion",
  "sore throat",
  // Immune / infection
  "common cold and flu",
  "immune resilience",
  "fever reduction",
  // Nervous / mood
  "insomnia and sleep quality",
  "anxiety and stress",
  "mild depression and low mood",
  "memory and focus",
  "migraine and tension headache",
  // Reproductive / sexual
  "menstrual cramps",
  "low libido",
  "fertility support",
  "prostate health",
  // Oral / ENT
  "oral health and gum care",
  "earache and ear infections",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Region = (typeof REGIONS)[number];
export type HealthCondition = (typeof HEALTH_CONDITIONS)[number];

export type DbSnapshot = {
  herbs: Array<{ name: string; category: Category | null; region: Region | null }>;
  remedies: Array<{ name: string; category: Category | null; region: Region | null }>;
  /** Primary herbs already covered by one or more remedies (dedup for new remedy choice). */
  remedyPrimaryHerbs: string[];
  /** health_condition free-text from existing remedies + pending submissions (for condition dedup). */
  remedyHealthConditions: string[];
};

export async function readDbSnapshot(): Promise<DbSnapshot> {
  const db = getDb();
  const [h, r, hs, rs, rsub] = await Promise.all([
    db
      .select({ name: herbs.common_name, category: herbs.category, region: herbs.region })
      .from(herbs),
    db
      .select({
        name: remedies.name,
        category: remedies.category,
        region: remedies.region,
        primary_herb_name: remedies.primary_herb_name,
        health_condition: remedies.health_condition,
      })
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
    db
      .select({ primary: sql<string>`${remedySubmissions.draft_payload}->>'primary_herb_name'` })
      .from(remedySubmissions),
  ]);

  const remedyPrimaries = new Set<string>();
  for (const x of r) if (x.primary_herb_name) remedyPrimaries.add(x.primary_herb_name);
  for (const x of rsub) if (x.primary) remedyPrimaries.add(x.primary);

  const remedyConditions: string[] = [];
  for (const x of r) if (x.health_condition) remedyConditions.push(x.health_condition);
  for (const x of rs) if (x.name) remedyConditions.push(x.name);

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
      ...rs.map((x) => ({ name: x.name, category: null, region: null })),
    ],
    remedyPrimaryHerbs: [...remedyPrimaries],
    remedyHealthConditions: remedyConditions,
  };
}

export type Plan = {
  kind: "herb" | "remedy";
  category: Category;
  region: Region;
  /** For remedies: the specific health condition the LLM should target. */
  targetCondition?: HealthCondition;
};

/**
 * Pick a (kind, category, region) that is UNDER-represented.
 * 1. Weighted random on kind — default 60% remedy, 40% herb. Override
 *    with the second arg (0..1 remedy probability).
 * 2. Pick the least-represented category for that kind.
 * 3. Pick the least-represented region for that kind within that category.
 * 4. Give West Africa a small nudge so the brief's region bias comes through.
 */
export function chooseNextPlan(snapshot: DbSnapshot, remedyRatio = 0.6): Plan {
  const kind: "herb" | "remedy" = Math.random() < remedyRatio ? "remedy" : "herb";
  const items = kind === "herb" ? snapshot.herbs : snapshot.remedies;

  // Category — least-represented, ties broken RANDOMLY (previously
  // always picked the first enum value, which caused Adaptogen to win
  // every time and the queue to cluster there).
  const categoryCounts = new Map<Category, number>();
  for (const c of CATEGORIES) categoryCounts.set(c, 0);
  for (const item of items) {
    if (item.category) categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }
  const category = minKeyRandomTie(categoryCounts);

  // Region — same picker, with an Africa nudge for the brief's bias.
  const regionCounts = new Map<Region, number>();
  for (const r of REGIONS) regionCounts.set(r, 0);
  for (const item of items) {
    if (item.category === category && item.region) {
      regionCounts.set(item.region, (regionCounts.get(item.region) ?? 0) + 1);
    }
  }
  regionCounts.set("Africa", (regionCounts.get("Africa") ?? 0) - 0.25);
  const region = minKeyRandomTie(regionCounts);

  // For remedies only, also pick a specific health condition to target.
  // The DB snapshot tracks a loose match on remedy.health_condition
  // text; we pick the condition whose keyword appears least often.
  let targetCondition: HealthCondition | undefined;
  if (kind === "remedy") {
    const conditionCounts = new Map<HealthCondition, number>();
    for (const c of HEALTH_CONDITIONS) conditionCounts.set(c, 0);
    for (const item of snapshot.remedies) {
      const haystack = (item.name ?? "").toLowerCase() +
        " " + ((item as { category?: string }).category ?? "").toLowerCase();
      for (const cond of HEALTH_CONDITIONS) {
        const keyword = (cond.split(/\s+/)[0] ?? "").toLowerCase();
        if (keyword && haystack.includes(keyword)) {
          conditionCounts.set(cond, (conditionCounts.get(cond) ?? 0) + 1);
        }
      }
    }
    for (const hc of snapshot.remedyHealthConditions) {
      const low = hc.toLowerCase();
      for (const cond of HEALTH_CONDITIONS) {
        const keyword = (cond.split(/\s+/)[0] ?? "").toLowerCase();
        if (keyword && low.includes(keyword)) {
          conditionCounts.set(cond, (conditionCounts.get(cond) ?? 0) + 1);
        }
      }
    }
    targetCondition = minKeyRandomTie(conditionCounts);
  }

  return { kind, category, region, targetCondition };
}

/**
 * Picks a key with the minimum count, breaking ties with a fresh
 * random draw. Essential for diversity — without this, the first key
 * declared in the enum always wins the 0-count tie and the agent
 * converges on it.
 */
function minKeyRandomTie<T>(m: Map<T, number>): T {
  let bestCount = Infinity;
  for (const v of m.values()) {
    if (v < bestCount) bestCount = v;
  }
  const tied: T[] = [];
  for (const [k, v] of m) {
    if (v === bestCount) tied.push(k);
  }
  if (tied.length === 0) throw new Error("no entries configured");
  return tied[Math.floor(Math.random() * tied.length)]!;
}

export function knownNames(snapshot: DbSnapshot, kind: "herb" | "remedy"): string[] {
  const names = kind === "herb" ? snapshot.herbs.map((h) => h.name) : snapshot.remedies.map((r) => r.name);
  return [...new Set(names)];
}
