/**
 * Regenerate missing fields on an agent-generated herb or remedy.
 *
 * POST /api/regenerate/herb/:id    (admin only)
 * POST /api/regenerate/remedy/:id  (admin only)
 *
 * Reuses the submission moderation pipeline — Serper search + Groq
 * enrichment — but only fills fields that are currently empty on the
 * record. Nothing already set is overwritten.
 *
 * Only operates on rows with agent_generated=true. Human-submitted
 * entries are untouched.
 */
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { herbs, remedies } from "../schema";
import { reserveBudget, recordUsage } from "../ai/budget";
import { chatJson, estimateChatTokens } from "../ai/groq";
import { search, filterCitedReferences } from "../ai/search";
import { logEvent } from "../ai/events";
import { getEnv } from "../env";
import { pingUnsplashDownload, searchUnsplash } from "../agent/unsplash";
import {
  buildHerbModerationPrompt,
  buildRemedyModerationPrompt,
  herbModerationOutputSchema,
  remedyModerationOutputSchema,
} from "../ai/submission-prompts";
import type { Variables } from "../router";

export const regenerateRoutes = new Hono<{ Variables: Variables }>();

function requireAdmin(c: Context<{ Variables: Variables }>) {
  const u = c.get("user");
  if (u.role !== "admin") {
    throw new HTTPException(403, { message: "Admin only", cause: { code: "forbidden" } });
  }
  return u;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Fetch a licensed stock photo for the record. Returns null if there's
 * no UNSPLASH_ACCESS_KEY, the search returns nothing, or the request
 * errors — image is a nice-to-have, never a blocker.
 */
async function fetchStockImage(query: string): Promise<string | null> {
  const env = getEnv();
  if (!env.UNSPLASH_ACCESS_KEY) return null;
  try {
    const img = await searchUnsplash(env.UNSPLASH_ACCESS_KEY, query);
    if (!img) return null;
    // Per Unsplash licence: ping the download endpoint when we use it.
    await pingUnsplashDownload(env.UNSPLASH_ACCESS_KEY, img.download_location);
    return img.url;
  } catch {
    return null;
  }
}

/**
 * Return a partial update: for each key in `enriched`, include it only
 * when the current record's value at that key is empty. Protects fields
 * the admin may have manually set.
 */
function fillMissing<T extends Record<string, unknown>>(
  current: T,
  enriched: Partial<T>,
): Partial<T> {
  const patch: Partial<T> = {};
  for (const [k, v] of Object.entries(enriched)) {
    if (v === undefined) continue;
    if (!isEmpty(current[k as keyof T])) continue;
    (patch as Record<string, unknown>)[k] = v;
  }
  return patch;
}

// ---------------------------------------------------------------------------

regenerateRoutes.post("/remedy/:id", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const db = getDb();

  const [row] = await db.select().from(remedies).where(eq(remedies.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: "Remedy not found" });
  if (!row.agent_generated) {
    throw new HTTPException(400, {
      message: "Regenerate is only available for agent-generated entries",
      cause: { code: "not_agent_generated" },
    });
  }

  // Build a submission-style input from the current row so we can reuse
  // the moderation prompt verbatim.
  const input = {
    name: row.name,
    primary_herb_name: row.primary_herb_name,
    herbs_used: row.herbs_used ?? [],
    health_condition: row.health_condition,
    preparation_method: row.preparation_method,
    dosage: row.dosage ?? "",
    duration_of_use: row.duration_of_use ?? "",
    observed_effects: row.observed_effects ?? "",
  };

  const query = `${row.primary_herb_name} ${row.health_condition} clinical study pubmed drug interactions contraindications`;
  const searchOutcome = await search(query);

  const { system, user: userMsg } = buildRemedyModerationPrompt(input as never, searchOutcome.results);
  const estTokens = estimateChatTokens([
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ]);
  const budget = await reserveBudget(estTokens);
  if (!budget.ok) {
    throw new HTTPException(503, {
      message: "AI budget exhausted — try again later.",
      cause: { code: "budget" },
    });
  }

  try {
    const result = await chatJson({
      system,
      user: userMsg,
      temperature: 0.15,
      parse: (obj) => remedyModerationOutputSchema.parse(obj),
    });
    const verdict = result.json;
    verdict.draft.research_references = filterCitedReferences(
      verdict.draft.research_references,
      searchOutcome.results,
    );
    // Apply the SAME backfill the submission handler does, so empty
    // usage fields (dosage / duration_of_use / observed_effects / etc.)
    // get sensible non-blank values instead of staying blank forever.
    const draft = verdict.draft as unknown as Record<string, unknown>;
    const inputRec = input as unknown as Record<string, string | undefined>;
    const strOrEmpty = (v: unknown) =>
      typeof v === "string" ? v.trim() : "";
    if (!strOrEmpty(draft.name)) draft.name = inputRec.name ?? "";
    if (!strOrEmpty(draft.health_condition)) draft.health_condition = inputRec.health_condition ?? "";
    if (!strOrEmpty(draft.primary_herb_name)) draft.primary_herb_name = inputRec.primary_herb_name ?? "";
    if (!strOrEmpty(draft.preparation_method)) draft.preparation_method = inputRec.preparation_method ?? "";
    if (!strOrEmpty(draft.dosage)) {
      draft.dosage = inputRec.dosage?.trim() ||
        "Follow traditional dosing (consult a qualified herbalist for individualised guidance).";
    }
    if (!strOrEmpty(draft.duration_of_use)) {
      draft.duration_of_use = inputRec.duration_of_use?.trim() ||
        "Short-term; typically up to 2 weeks. Reassess with a practitioner if continuing.";
    }
    if (!strOrEmpty(draft.observed_effects)) {
      draft.observed_effects = inputRec.observed_effects?.trim() ||
        `Traditionally used for ${inputRec.health_condition ?? "this condition"}; individual response varies and may take 1–2 weeks of consistent use to appear.`;
    }
    if (!strOrEmpty(draft.description)) {
      draft.description = `${inputRec.name}: ${draft.observed_effects}. Prepared by ${draft.preparation_method}`;
    }

    await recordUsage({
      endpoint: "regenerate-remedy",
      model: result.model,
      inputTokens: result.usage.input_tokens || estTokens,
      outputTokens: result.usage.output_tokens,
    });

    // Fetch a stock image if the record doesn't already have one.
    // Unsplash's licence requires a per-use download ping, which the
    // helper handles for us.
    let fetchedImage: string | null = null;
    if (isEmpty(row.image_url)) {
      fetchedImage = await fetchStockImage(`${row.primary_herb_name} herbal tea plant`);
    }
    const draftWithImage: Record<string, unknown> = {
      ...(verdict.draft as unknown as Record<string, unknown>),
    };
    if (fetchedImage) draftWithImage.image_url = fetchedImage;

    const patch = fillMissing(row as unknown as Record<string, unknown>, draftWithImage);
    if (Object.keys(patch).length > 0) {
      const updates: Record<string, unknown> = { ...patch, updated_date: sql`now()` };
      await db
        .update(remedies)
        .set(updates as never)
        .where(eq(remedies.id, id));
    }

    await logEvent({
      endpoint: "regenerate-remedy",
      userEmail: c.get("user").email,
      submissionId: id,
      verdict: verdict.moderation_status,
      model: result.model,
      provider: "groq",
      searchProvider: searchOutcome.provider,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      summary: { fields_filled: Object.keys(patch), refs: verdict.draft.research_references.length },
    });

    const [updated] = await db.select().from(remedies).where(eq(remedies.id, id)).limit(1);
    return c.json({
      ok: true,
      filled_fields: Object.keys(patch),
      record: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HTTPException(503, {
      message: `AI regeneration failed: ${msg}`,
      cause: { code: "ai_unavailable" },
    });
  }
});

// ---------------------------------------------------------------------------

regenerateRoutes.post("/herb/:id", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const db = getDb();

  const [row] = await db.select().from(herbs).where(eq(herbs.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: "Herb not found" });
  if (!row.agent_generated) {
    throw new HTTPException(400, {
      message: "Regenerate is only available for agent-generated entries",
      cause: { code: "not_agent_generated" },
    });
  }

  const input = {
    common_name: row.common_name,
    botanical_name: row.botanical_name ?? "",
    description: row.description,
    region: row.region ?? undefined,
    category: row.category ?? undefined,
  };

  const query = `${row.common_name} ${row.botanical_name ?? ""} clinical study pubmed drug interactions contraindications`;
  const searchOutcome = await search(query);

  const { system, user: userMsg } = buildHerbModerationPrompt(input as never, searchOutcome.results);
  const estTokens = estimateChatTokens([
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ]);
  const budget = await reserveBudget(estTokens);
  if (!budget.ok) {
    throw new HTTPException(503, {
      message: "AI budget exhausted — try again later.",
      cause: { code: "budget" },
    });
  }

  try {
    const result = await chatJson({
      system,
      user: userMsg,
      temperature: 0.15,
      parse: (obj) => herbModerationOutputSchema.parse(obj),
    });
    const verdict = result.json;
    verdict.draft.research_references = filterCitedReferences(
      verdict.draft.research_references,
      searchOutcome.results,
    );
    // Backfill required-ish fields from the current record if the AI
    // dropped them, so blanks don't persist across regenerate clicks.
    const hd = verdict.draft as unknown as Record<string, unknown>;
    const hi = input as unknown as Record<string, string | undefined>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    if (!str(hd.common_name)) hd.common_name = hi.common_name ?? "";
    if (!str(hd.botanical_name)) hd.botanical_name = hi.botanical_name ?? "";
    if (!str(hd.description)) hd.description = hi.description ?? "";
    if (!str(hd.dosage)) {
      hd.dosage = "Follow traditional dosing (consult a qualified herbalist for individualised guidance).";
    }

    await recordUsage({
      endpoint: "regenerate-herb",
      model: result.model,
      inputTokens: result.usage.input_tokens || estTokens,
      outputTokens: result.usage.output_tokens,
    });

    let fetchedImage: string | null = null;
    if (isEmpty(row.image_url)) {
      fetchedImage = await fetchStockImage(`${row.common_name} ${row.botanical_name ?? ""} plant leaves herb`);
    }
    const draftWithImage: Record<string, unknown> = {
      ...(verdict.draft as unknown as Record<string, unknown>),
    };
    if (fetchedImage) draftWithImage.image_url = fetchedImage;

    const patch = fillMissing(row as unknown as Record<string, unknown>, draftWithImage);
    if (Object.keys(patch).length > 0) {
      const updates: Record<string, unknown> = { ...patch, updated_date: sql`now()` };
      await db
        .update(herbs)
        .set(updates as never)
        .where(eq(herbs.id, id));
    }

    await logEvent({
      endpoint: "regenerate-herb",
      userEmail: c.get("user").email,
      submissionId: id,
      verdict: verdict.moderation_status,
      model: result.model,
      provider: "groq",
      searchProvider: searchOutcome.provider,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      summary: { fields_filled: Object.keys(patch), refs: verdict.draft.research_references.length },
    });

    const [updated] = await db.select().from(herbs).where(eq(herbs.id, id)).limit(1);
    return c.json({
      ok: true,
      filled_fields: Object.keys(patch),
      record: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HTTPException(503, {
      message: `AI regeneration failed: ${msg}`,
      cause: { code: "ai_unavailable" },
    });
  }
});
