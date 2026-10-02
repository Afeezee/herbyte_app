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
    await recordUsage({
      endpoint: "regenerate-remedy",
      model: result.model,
      inputTokens: result.usage.input_tokens || estTokens,
      outputTokens: result.usage.output_tokens,
    });

    const patch = fillMissing(row as unknown as Record<string, unknown>, verdict.draft as unknown as Record<string, unknown>);
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
    await recordUsage({
      endpoint: "regenerate-herb",
      model: result.model,
      inputTokens: result.usage.input_tokens || estTokens,
      outputTokens: result.usage.output_tokens,
    });

    const patch = fillMissing(row as unknown as Record<string, unknown>, verdict.draft as unknown as Record<string, unknown>);
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
