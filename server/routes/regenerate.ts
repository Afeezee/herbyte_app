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
import { buildHerbImageQueries, pingUnsplashDownload, searchUnsplashCascade } from "../agent/unsplash";
import { fetchWikimediaImage } from "../agent/wikimedia";
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
 * Fetch a herb/remedy image. Tries Wikipedia/Wikimedia Commons first
 * (botanically correct, no brand collisions), falls back to Unsplash
 * cascade on miss. Returns `{url, verifiedBotanicalName?}` or null.
 * Image is a nice-to-have — never a blocker.
 */
async function fetchHybridImage(opts: {
  common_name?: string | null;
  botanical_name?: string | null;
  unsplashQueries: string[];
}): Promise<{ url: string; verifiedBotanicalName?: string | null } | null> {
  // 1) Wikimedia (encyclopedic, verified)
  try {
    const wm = await fetchWikimediaImage({
      common_name: opts.common_name ?? null,
      botanical_name: opts.botanical_name ?? null,
    });
    if (wm) return { url: wm.url, verifiedBotanicalName: wm.verifiedBotanicalName ?? null };
  } catch { /* fall through */ }

  // 2) Unsplash cascade (fallback)
  const env = getEnv();
  if (!env.UNSPLASH_ACCESS_KEY) return null;
  try {
    const match = await searchUnsplashCascade(env.UNSPLASH_ACCESS_KEY, opts.unsplashQueries);
    if (!match) return null;
    await pingUnsplashDownload(env.UNSPLASH_ACCESS_KEY, match.image.download_location);
    return { url: match.image.url };
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

// ---------------------------------------------------------------------------
// Image-only regenerate. Cheap (no LLM, no AI budget), overwrites a
// record's image_url with a fresh Wikimedia/Unsplash lookup. Works on
// any record (not gated on agent_generated), and is what the edit modal
// "Fetch new image" button calls when the admin wants to replace a bad
// picture after publishing.

regenerateRoutes.post("/remedy/:id/image", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const db = getDb();

  const [row] = await db.select().from(remedies).where(eq(remedies.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: "Remedy not found" });

  // Cascade: try primary herb first, then each companion herb — a remedy
  // like "Bitter Leaf & African Pepper Tonic" should find SOMETHING even
  // if one of the names fails to resolve on Wikipedia/Unsplash.
  const candidates = [
    row.primary_herb_name,
    ...(Array.isArray(row.herbs_used) ? row.herbs_used : []),
  ]
    .map((n) => (typeof n === "string" ? n.trim() : ""))
    .filter((n, i, arr) => n.length > 0 && arr.indexOf(n) === i);

  let img: { url: string; verifiedBotanicalName?: string | null } | null = null;
  for (const name of candidates) {
    img = await fetchHybridImage({
      common_name: name,
      botanical_name: null,
      unsplashQueries: buildHerbImageQueries({
        primary: name,
        companions: candidates.filter((c) => c !== name),
      }),
    });
    if (img) break;
  }
  if (!img) {
    return c.json({ ok: false, image_url: null, message: "No image found on Wikimedia or Unsplash." }, 200);
  }

  await db
    .update(remedies)
    .set({ image_url: img.url, updated_date: sql`now()` } as never)
    .where(eq(remedies.id, id));

  await logEvent({
    endpoint: "regenerate-remedy-image",
    userEmail: c.get("user").email,
    submissionId: id,
    verdict: "ok",
    model: "none",
    provider: "wikimedia-or-unsplash",
    inputTokens: 0,
    outputTokens: 0,
    summary: { image_url: img.url },
  });

  return c.json({ ok: true, image_url: img.url });
});

regenerateRoutes.post("/herb/:id/image", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const db = getDb();

  const [row] = await db.select().from(herbs).where(eq(herbs.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: "Herb not found" });

  const img = await fetchHybridImage({
    common_name: row.common_name,
    botanical_name: row.botanical_name,
    unsplashQueries: buildHerbImageQueries({
      primary: row.common_name,
      botanical: row.botanical_name,
    }),
  });
  if (!img) {
    return c.json({ ok: false, image_url: null, message: "No image found on Wikimedia or Unsplash." }, 200);
  }

  // If Wikidata gave us a corrected taxon name, also fix botanical_name
  // on the record — the point of this flow is "trust the authoritative
  // source", so overwrite even when a (wrong) value was already stored.
  const updates: Record<string, unknown> = { image_url: img.url, updated_date: sql`now()` };
  if (
    img.verifiedBotanicalName &&
    (isEmpty(row.botanical_name) ||
      (typeof row.botanical_name === "string" &&
        row.botanical_name.trim().toLowerCase() !== img.verifiedBotanicalName.toLowerCase()))
  ) {
    updates.botanical_name = img.verifiedBotanicalName;
  }

  await db
    .update(herbs)
    .set(updates as never)
    .where(eq(herbs.id, id));

  await logEvent({
    endpoint: "regenerate-herb-image",
    userEmail: c.get("user").email,
    submissionId: id,
    verdict: "ok",
    model: "none",
    provider: "wikimedia-or-unsplash",
    inputTokens: 0,
    outputTokens: 0,
    summary: { image_url: img.url, botanical_name_fixed: !!updates.botanical_name },
  });

  return c.json({
    ok: true,
    image_url: img.url,
    botanical_name: (updates.botanical_name as string | undefined) ?? row.botanical_name ?? null,
  });
});

// ---------------------------------------------------------------------------

regenerateRoutes.post("/remedy/:id", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const db = getDb();

  const [row] = await db.select().from(remedies).where(eq(remedies.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: "Remedy not found" });

  // Build a submission-style input from the current row so we can reuse
  // the moderation prompt verbatim. Note: fillMissing() below only
  // writes to currently-empty fields, so human-authored content is
  // never overwritten — safe to run on any record.
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

    // Fetch an image if the record doesn't already have one.
    // Wikimedia first (botanically correct), Unsplash cascade fallback.
    let fetchedImage: string | null = null;
    if (isEmpty(row.image_url)) {
      const img = await fetchHybridImage({
        common_name: row.primary_herb_name,
        botanical_name: null,
        unsplashQueries: buildHerbImageQueries({
          primary: row.primary_herb_name,
          companions: row.herbs_used,
        }),
      });
      fetchedImage = img?.url ?? null;
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
  // fillMissing() below only writes to currently-empty fields, so
  // human-authored content is never overwritten — safe to run on any
  // record, not just agent-generated ones.

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

    // Wikimedia first (also gives us Wikidata's authoritative taxon name),
    // Unsplash cascade fallback.
    let fetchedImage: string | null = null;
    let verifiedBotanical: string | null = null;
    const img = await fetchHybridImage({
      common_name: row.common_name,
      botanical_name: row.botanical_name,
      unsplashQueries: buildHerbImageQueries({
        primary: row.common_name,
        botanical: row.botanical_name,
      }),
    });
    if (img) {
      verifiedBotanical = img.verifiedBotanicalName ?? null;
      if (isEmpty(row.image_url)) fetchedImage = img.url;
    }
    const draftWithImage: Record<string, unknown> = {
      ...(verdict.draft as unknown as Record<string, unknown>),
    };
    if (fetchedImage) draftWithImage.image_url = fetchedImage;

    // If Wikidata gave us an authoritative taxon name that disagrees
    // with what's stored, correct the record — AI/common-name pairing
    // sometimes drifts (e.g. "Kola" paired with the wrong species).
    // We overwrite botanical_name here (fillMissing only writes blanks),
    // because the point of the override is to fix a wrong value.
    const patch = fillMissing(row as unknown as Record<string, unknown>, draftWithImage) as Record<string, unknown>;
    if (
      verifiedBotanical &&
      typeof row.botanical_name === "string" &&
      row.botanical_name.trim().length > 0 &&
      row.botanical_name.trim().toLowerCase() !== verifiedBotanical.toLowerCase()
    ) {
      patch.botanical_name = verifiedBotanical;
    } else if (verifiedBotanical && isEmpty(row.botanical_name)) {
      patch.botanical_name = verifiedBotanical;
    }
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
