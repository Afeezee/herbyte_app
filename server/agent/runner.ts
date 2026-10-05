/**
 * The content agent's orchestration — shared by the CLI
 * (scripts/generate-content.ts) and the cron endpoint
 * (server/routes/agent.ts). Both pass in a `submit` function that
 * actually POSTs to /api/submissions/{herb,remedy} — the CLI uses
 * fetch to a public URL, the cron does the same via app.fetch
 * in-process.
 */
import { z } from "zod";
import { chatJson } from "../ai/groq";
import { search } from "../ai/search";
import { getEnv } from "../env";
import { countAgentSubmissionsToday } from "./counter";
import {
  CATEGORIES,
  REGIONS,
  chooseNextPlan,
  knownNames,
  readDbSnapshot,
} from "./diversity";
import { buildHerbChoicePrompt, buildRemedyChoicePrompt } from "./prompts";
import { buildHerbImageQueries, pingUnsplashDownload, searchUnsplashCascade } from "./unsplash";
import { fetchWikimediaImage } from "./wikimedia";

// ---------------------------------------------------------------------------
// Lightweight schemas for the agent's own generation call. The real
// submission schemas live in server/ai/submission-prompts.ts.
// ---------------------------------------------------------------------------

const herbChoiceSchema = z.object({
  common_name: z.string().min(2).max(200),
  botanical_name: z.string().max(200).optional().default(""),
  description: z.string().min(20).max(4000),
  region: z.enum(REGIONS),
  category: z.enum(CATEGORIES),
});
export type HerbChoice = z.infer<typeof herbChoiceSchema>;

const remedyChoiceSchema = z.object({
  name: z.string().min(3).max(200),
  primary_herb_name: z.string().min(1).max(200),
  herbs_used: z.array(z.string()).max(10).default([]),
  health_condition: z.string().min(2).max(500),
  preparation_method: z.string().min(10).max(4000),
  dosage: z.string().max(1000).optional().default(""),
  duration_of_use: z.string().max(500).optional().default(""),
  observed_effects: z.string().min(2).max(2000),
});
export type RemedyChoice = z.infer<typeof remedyChoiceSchema>;

// ---------------------------------------------------------------------------

export type SubmitFn = (
  path: "/api/submissions/herb" | "/api/submissions/remedy",
  body: Record<string, unknown>,
) => Promise<
  | {
      ok: true;
      data: {
        id?: string;
        moderation_status?: string;
        ai_feedback?: string;
        auto_published?: boolean;
        published_remedy_id?: string | null;
        published_herb_id?: string | null;
      };
    }
  | { ok: false; status: number; message: string }
>;

export type AgentRunOptions = {
  submit: SubmitFn;
  forceKind?: "herb" | "remedy";
  forceResearch?: boolean;
  skipResearch?: boolean;
  dryRun?: boolean;
  /** Submit but skip auto-publish — the entry lands in the admin queue. */
  draftOnly?: boolean;
  /** Pin a specific herb — for herb mode this becomes common_name,
   *  for remedy mode this becomes primary_herb_name. Overrides diversity. */
  targetHerb?: string | null;
  /** Pin a specific region. Overrides diversity. */
  targetRegion?: import("./diversity").Region | null;
  /** Pin a specific health condition the remedy targets. Free text —
   *  the admin can pick from the curated list or supply something custom. */
  targetCondition?: string | null;
};

export type PerPostResult = {
  ok: boolean;
  kind: "herb" | "remedy";
  display_name?: string;
  category?: string;
  region?: string;
  generation_method?: "research" | "model-only";
  image_url?: string | null;
  image_attribution?: string | null;
  moderation_status?: string;
  submission_id?: string;
  published_id?: string | null;
  auto_published?: boolean;
  error?: string;
};

export type AgentRunReport = {
  attempted: number;
  posted: number;
  todayAfter: number;
  dailyCap: number;
  results: PerPostResult[];
  skippedReason?: "cap_reached" | "misconfigured";
};

// ---------------------------------------------------------------------------
// Driver — runs up to `n` posts, respecting the DB-backed daily cap.
// ---------------------------------------------------------------------------

// Max concurrent runOne() invocations per batch. Each post makes TWO
// Groq calls (agent draft + server moderation, ~2k tokens each). On
// Groq's 8000 TPM free tier even 2 parallel runs burst 8k tokens into
// a single minute and 429. Set 1 for safe sequential; raise once on
// paid Dev Tier (24k TPM).
const BATCH_CONCURRENCY = 1;

export async function runAgentBatch(n: number, opts: AgentRunOptions): Promise<AgentRunReport> {
  const env = getEnv();

  if (!env.AGENT_AUTHOR_EMAIL || !env.AGENT_AUTHOR_NAME) {
    return {
      attempted: 0,
      posted: 0,
      todayAfter: 0,
      dailyCap: env.AGENT_DAILY_CAP,
      results: [],
      skippedReason: "misconfigured",
    };
  }
  if (!env.GROQ_API_KEY) {
    return {
      attempted: 0,
      posted: 0,
      todayAfter: 0,
      dailyCap: env.AGENT_DAILY_CAP,
      results: [],
      skippedReason: "misconfigured",
    };
  }

  const dailyCap = env.AGENT_DAILY_CAP;
  const todayCount = await countAgentSubmissionsToday(env.AGENT_AUTHOR_EMAIL);
  if (todayCount >= dailyCap) {
    return {
      attempted: 0,
      posted: 0,
      todayAfter: todayCount,
      dailyCap,
      results: [],
      skippedReason: "cap_reached",
    };
  }

  const allowed = Math.max(0, Math.min(n, dailyCap - todayCount));
  const results: PerPostResult[] = [];
  let posted = 0;

  // Parallel batches: run up to BATCH_CONCURRENCY posts in flight at
  // once, re-checking the DB cap between batches so two overlapping
  // invocations can't overshoot. Sequential within one post (research →
  // draft → image → submit) but parallel across posts.
  let launched = 0;
  while (launched < allowed) {
    const current = await countAgentSubmissionsToday(env.AGENT_AUTHOR_EMAIL);
    if (current >= dailyCap) break;
    const remainingByCap = dailyCap - current;
    const remainingByRequest = allowed - launched;
    const size = Math.min(BATCH_CONCURRENCY, remainingByCap, remainingByRequest);
    if (size <= 0) break;
    const batch = await Promise.all(
      Array.from({ length: size }, () => runOne(opts).catch((err) => ({
        ok: false as const,
        kind: "remedy" as const,
        error: `runOne threw: ${(err as Error).message}`,
      }))),
    );
    for (const r of batch) {
      results.push(r as PerPostResult);
      // Only count genuinely-published entries. An auto-rejected
      // submission (no verifiable citations) doesn't count toward the
      // daily cap and doesn't inflate the "posted" tally.
      if (!opts.dryRun && (r as PerPostResult).auto_published) posted++;
    }
    launched += size;
  }

  const todayAfter = await countAgentSubmissionsToday(env.AGENT_AUTHOR_EMAIL);
  return { attempted: results.length, posted, todayAfter, dailyCap, results };
}

async function runOne(opts: AgentRunOptions): Promise<PerPostResult> {
  const env = getEnv();
  const snapshot = await readDbSnapshot();
  let plan = chooseNextPlan(snapshot);
  if (opts.forceKind) plan = { ...plan, kind: opts.forceKind };
  if (opts.targetRegion) plan = { ...plan, region: opts.targetRegion };
  if (opts.targetCondition) {
    // Override whatever the diversity planner chose. Cast is safe —
    // prompts treat targetCondition as a free-form string anyway;
    // the enum is just a convenience for the auto-pick path.
    plan = { ...plan, targetCondition: opts.targetCondition.trim() as never };
  }
  const targetHerb = opts.targetHerb?.trim() || null;

  const doResearch =
    opts.forceResearch || (!opts.skipResearch && Math.random() < env.AGENT_RESEARCH_RATIO);
  const method: "research" | "model-only" = doResearch ? "research" : "model-only";

  let researchResults = null as Awaited<ReturnType<typeof search>>["results"] | null;
  if (doResearch && env.SERPER_API_KEY) {
    const query =
      plan.kind === "herb"
        ? `${plan.region} ${plan.category} herbs traditional medicine ethnobotany`
        : `${plan.region} ${plan.category} herbal remedy preparation traditional`;
    try {
      const outcome = await search(query);
      researchResults = outcome.results;
    } catch {
      researchResults = null;
    }
  }

  const avoid = knownNames(snapshot, plan.kind);
  // For remedies, pass the set of primary herbs already covered so the
  // model doesn't invent a third tea built around Moringa, etc.
  const remedyAvoidHerbs = plan.kind === "remedy" ? snapshot.remedyPrimaryHerbs : [];
  let choice: HerbChoice | RemedyChoice | null = null;
  for (let attempt = 0; attempt < 3 && !choice; attempt++) {
    try {
      if (plan.kind === "herb") {
        const { system, user } = buildHerbChoicePrompt({
          category: plan.category,
          region: plan.region,
          avoid: avoid.slice(0, 60),
          fixedCommonName: targetHerb,
          researchResults,
        });
        const r = await chatJson({ system, user, temperature: 0.6, parse: (o) => herbChoiceSchema.parse(o) });
        const c = r.json;
        // When the user pinned a specific herb, skip the dedup — they
        // know what they want and may be deliberately adding something
        // that's close to an existing entry.
        if (!targetHerb && nameConflicts(c.common_name, avoid)) {
          avoid.push(c.common_name);
          continue;
        }
        choice = c;
      } else {
        const { system, user } = buildRemedyChoicePrompt({
          category: plan.category,
          region: plan.region,
          avoid: avoid.slice(0, 60),
          avoidPrimaryHerbs: targetHerb ? [] : remedyAvoidHerbs.slice(0, 40),
          targetCondition: plan.targetCondition ?? null,
          fixedPrimary: targetHerb,
          researchResults,
        });
        const r = await chatJson({ system, user, temperature: 0.6, parse: (o) => remedyChoiceSchema.parse(o) });
        const c = r.json;
        // When the user pinned a herb, we WANT more remedies of that
        // herb — skip both the name dedup and the primary-herb dedup.
        if (!targetHerb) {
          if (nameConflicts(c.name, avoid)) {
            avoid.push(c.name);
            continue;
          }
          if (c.primary_herb_name && nameConflicts(c.primary_herb_name, remedyAvoidHerbs)) {
            remedyAvoidHerbs.push(c.primary_herb_name);
            continue;
          }
        }
        choice = c;
      }
    } catch (err) {
      // retry
      if (attempt === 2) {
        return {
          ok: false,
          kind: plan.kind,
          category: plan.category,
          region: plan.region,
          generation_method: method,
          error: `draft failed: ${(err as Error).message}`,
        };
      }
    }
  }
  if (!choice) {
    return {
      ok: false,
      kind: plan.kind,
      category: plan.category,
      region: plan.region,
      generation_method: method,
      error: "could not draft a non-duplicate entry after 3 tries",
    };
  }

  const displayName =
    "common_name" in choice ? choice.common_name : (choice as RemedyChoice).name;

  // Image: try Wikimedia first (correct botanical identification), then
  // Unsplash as a lifestyle-aesthetic fallback. Wikimedia also returns
  // the Wikidata-verified botanical name as a free side-effect — we
  // use it to overwrite the AI's botanical name if the two disagree.
  let image: { url: string; attribution: string } | null = null;
  const commonName =
    plan.kind === "herb"
      ? (choice as HerbChoice).common_name
      : (choice as RemedyChoice).primary_herb_name;
  const botanicalName =
    plan.kind === "herb" ? (choice as HerbChoice).botanical_name : null;
  try {
    const wm = await fetchWikimediaImage({
      common_name: commonName,
      botanical_name: botanicalName,
    });
    if (wm) {
      image = { url: wm.url, attribution: wm.attribution };
      // Correct the AI's botanical name against Wikidata's taxon name
      // when both exist and disagree. Preserves whatever the AI put
      // when Wikidata has nothing to verify against.
      if (
        plan.kind === "herb" &&
        wm.verifiedBotanicalName &&
        botanicalName &&
        botanicalName.toLowerCase() !== wm.verifiedBotanicalName.toLowerCase()
      ) {
        (choice as HerbChoice).botanical_name = wm.verifiedBotanicalName;
      }
    }
  } catch {
    // Wikimedia best-effort — fall through to Unsplash.
  }
  if (!image && env.UNSPLASH_ACCESS_KEY) {
    try {
      const queries =
        plan.kind === "herb"
          ? buildHerbImageQueries({
              primary: (choice as HerbChoice).common_name,
              botanical: (choice as HerbChoice).botanical_name,
            })
          : buildHerbImageQueries({
              primary: (choice as RemedyChoice).primary_herb_name,
              companions: (choice as RemedyChoice).herbs_used,
            });
      const match = await searchUnsplashCascade(env.UNSPLASH_ACCESS_KEY, queries);
      if (match) {
        image = { url: match.image.url, attribution: match.image.attribution };
        if (!opts.dryRun) {
          await pingUnsplashDownload(env.UNSPLASH_ACCESS_KEY, match.image.download_location);
        }
      }
    } catch {
      /* fall through */
    }
  }

  // Build the submission body matching the public schema.
  const body: Record<string, unknown> =
    plan.kind === "herb"
      ? {
          common_name: (choice as HerbChoice).common_name,
          botanical_name: (choice as HerbChoice).botanical_name || undefined,
          description: (choice as HerbChoice).description,
          region: (choice as HerbChoice).region,
          category: (choice as HerbChoice).category,
          submitter_name: env.AGENT_AUTHOR_NAME,
          submitter_contact: env.AGENT_AUTHOR_EMAIL,
          image_url: image?.url,
        }
      : {
          name: (choice as RemedyChoice).name,
          primary_herb_name: (choice as RemedyChoice).primary_herb_name,
          herbs_used: (choice as RemedyChoice).herbs_used,
          health_condition: (choice as RemedyChoice).health_condition,
          preparation_method: (choice as RemedyChoice).preparation_method,
          dosage: (choice as RemedyChoice).dosage || undefined,
          duration_of_use: (choice as RemedyChoice).duration_of_use || undefined,
          observed_effects: (choice as RemedyChoice).observed_effects,
          submitter_name: env.AGENT_AUTHOR_NAME,
          submitter_contact: env.AGENT_AUTHOR_EMAIL,
          image_url: image?.url,
        };

  if (opts.dryRun) {
    return {
      ok: true,
      kind: plan.kind,
      display_name: displayName,
      category: plan.category,
      region: plan.region,
      generation_method: method,
      image_url: image?.url ?? null,
      image_attribution: image?.attribution ?? null,
      moderation_status: "DRY_RUN",
    };
  }

  const basePath = plan.kind === "herb" ? "/api/submissions/herb" : "/api/submissions/remedy";
  const path = (opts.draftOnly ? `${basePath}?draft=1` : basePath) as
    | "/api/submissions/herb"
    | "/api/submissions/remedy";
  const res = await opts.submit(path, body);
  if (!res.ok) {
    return {
      ok: false,
      kind: plan.kind,
      display_name: displayName,
      category: plan.category,
      region: plan.region,
      generation_method: method,
      image_url: image?.url ?? null,
      image_attribution: image?.attribution ?? null,
      error: `HTTP ${res.status}: ${res.message}`,
    };
  }
  return {
    ok: true,
    kind: plan.kind,
    display_name: displayName,
    category: plan.category,
    region: plan.region,
    generation_method: method,
    image_url: image?.url ?? null,
    image_attribution: image?.attribution ?? null,
    moderation_status: res.data.moderation_status,
    submission_id: res.data.id,
    auto_published: !!res.data.auto_published,
    published_id:
      res.data.published_remedy_id ?? res.data.published_herb_id ?? null,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function nameConflicts(name: string, avoid: string[]): boolean {
  const target = slugify(name);
  for (const a of avoid) {
    const other = slugify(a);
    if (!other || !target) continue;
    if (other === target) return true;
    if (other.includes(target) || target.includes(other)) {
      if (Math.min(other.length, target.length) >= 4) return true;
    }
  }
  return false;
}
