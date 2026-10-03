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
import { pingUnsplashDownload, searchUnsplash, type UnsplashImage } from "./unsplash";

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

// Max concurrent runOne() invocations per batch. Each post actually
// makes TWO Groq calls (one agent draft + one server moderation), so
// 2 in-flight ≈ 4 Groq calls at once. Groq free-tier TPM is 8000 and
// each call uses ~2000 tokens, so 2 is the ceiling before 429s.
const BATCH_CONCURRENCY = 2;

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
          researchResults,
        });
        const r = await chatJson({ system, user, temperature: 0.6, parse: (o) => herbChoiceSchema.parse(o) });
        const c = r.json;
        if (nameConflicts(c.common_name, avoid)) {
          avoid.push(c.common_name);
          continue;
        }
        choice = c;
      } else {
        const { system, user } = buildRemedyChoicePrompt({
          category: plan.category,
          region: plan.region,
          avoid: avoid.slice(0, 60),
          avoidPrimaryHerbs: remedyAvoidHerbs.slice(0, 40),
          targetCondition: plan.targetCondition ?? null,
          researchResults,
        });
        const r = await chatJson({ system, user, temperature: 0.6, parse: (o) => remedyChoiceSchema.parse(o) });
        const c = r.json;
        if (nameConflicts(c.name, avoid)) {
          avoid.push(c.name);
          continue;
        }
        // Reject if the primary herb is already heavily used in existing
        // remedies — forces the model to pick a different star herb.
        if (c.primary_herb_name && nameConflicts(c.primary_herb_name, remedyAvoidHerbs)) {
          remedyAvoidHerbs.push(c.primary_herb_name);
          continue;
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

  // Stock image.
  let image: UnsplashImage | null = null;
  if (env.UNSPLASH_ACCESS_KEY) {
    try {
      const q =
        plan.kind === "herb"
          ? `${(choice as HerbChoice).common_name} plant leaves herb`
          : `${(choice as RemedyChoice).primary_herb_name} tea herbs`;
      image = await searchUnsplash(env.UNSPLASH_ACCESS_KEY, q);
      if (image && !opts.dryRun) {
        await pingUnsplashDownload(env.UNSPLASH_ACCESS_KEY, image.download_location);
      }
    } catch {
      image = null;
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
