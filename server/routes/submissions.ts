/**
 * Submission pipeline (section 7 of the migration prompt).
 *
 * POST /api/submissions/remedy
 *   - Rate-limit (5/day).
 *   - Search Serper for context.
 *   - Ask Groq to moderate + enrich.
 *   - Server-side filter research_references against the search results
 *     (F4 fix).
 *   - Insert a remedy_submissions row with the AI verdict + enriched
 *     draft_payload + ready_to_publish=(status==="Approved").
 *   - NEVER call remedies.insert() from here. Publication requires an
 *     admin (POST /api/submissions/remedy/:id/publish).
 *   - On AI failure: save row with moderation_status="Pending Review",
 *     expert_review_required=true. Never silently drop.
 *
 * POST /api/submissions/herb — same pattern.
 *
 * POST /api/submissions/remedy/:id/publish   (admin only)
 * POST /api/submissions/herb/:id/publish     (admin only)
 *   - Read the submission, read the current draft_payload, allow the
 *     admin to override any field via the body, run a transaction that
 *     inserts the herb/remedy row and updates the submission with the
 *     new published_*_id + moderation_status="Approved".
 */
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, withTransaction } from "../db";
import {
  herbSubmissions,
  herbs,
  remedies,
  remedySubmissions,
} from "../schema";
import { checkAndConsume } from "../ai/rate-limit";
import { hashInput } from "../ai/cache";
import { reserveBudget, recordUsage } from "../ai/budget";
import { chatJson, GroqError, estimateChatTokens } from "../ai/groq";
import { logEvent } from "../ai/events";
import { search, filterCitedReferences } from "../ai/search";
import {
  buildHerbModerationPrompt,
  buildRemedyModerationPrompt,
  herbModerationOutputSchema,
  herbSubmissionInputSchema,
  remedyModerationOutputSchema,
  remedySubmissionInputSchema,
} from "../ai/submission-prompts";
import type { Variables } from "../router";

export const submissionRoutes = new Hono<{ Variables: Variables }>();

// ---------------------------------------------------------------------------
// Remedy submission
// ---------------------------------------------------------------------------

submissionRoutes.post("/remedy", async (c) => {
  const user = c.get("user");
  const isAgent = !!c.req.header("x-agent-service-token");
  const body = await c.req.json().catch(() => ({}));
  const parsed = remedySubmissionInputSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => i.message).join("; "),
      cause: { code: "invalid_body" },
    });
  }
  const input = parsed.data;

  // Content agent runs its own daily cap (AGENT_DAILY_CAP, enforced in
  // scripts/generate-content.ts). Skip the per-user 5/day cap so the
  // agent isn't blocked at 6+ posts/day.
  if (!isAgent) {
    const rl = await checkAndConsume("submissions", user.email);
    if (!rl.ok) {
      c.header("Retry-After", String(rl.retryAfterSeconds));
      throw new HTTPException(429, {
        message: rl.message,
        cause: { code: "rate_limited" },
      });
    }
  }

  // Search context for the model.
  const searchQuery = `"${input.name}" ${input.primary_herb_name} ${input.health_condition} drug interactions contraindications research`;
  const searchOutcome = await search(searchQuery);

  const { system, user: userMsg } = buildRemedyModerationPrompt(input, searchOutcome.results);
  const estTokens = estimateChatTokens([
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ]);
  const inputHash = hashInput("submission-remedy", input);

  const db = getDb();
  const budget = await reserveBudget(estTokens);
  if (!budget.ok) {
    // Never silently drop: save the submission with Pending Review and
    // flag it for retry (cron picks these up).
    const [row] = (await db
      .insert(remedySubmissions)
      .values({
        herbs_used: [input.primary_herb_name, ...(input.herbs_used ?? [])],
        health_condition: input.health_condition,
        preparation_method: input.preparation_method,
        dosage: input.dosage ?? null,
        duration_of_use: input.duration_of_use ?? null,
        observed_effects: input.observed_effects,
        submitter_name: input.submitter_name ?? null,
        submitter_contact: input.submitter_contact ?? null,
        moderation_status: "Pending Review",
        ai_feedback: `Deferred: LLM budget exhausted (${budget.code}).`,
        expert_review_required: true,
        draft_payload: null,
        ready_to_publish: false,
        references_pending_review: true,
        created_by: user.email,
      })
      .returning()) as unknown as Array<{ id: string }>;
    await logEvent({
      endpoint: "submission-remedy",
      userEmail: user.email,
      submissionId: row?.id ?? null,
      inputHash,
      errorCode: `budget_${budget.code}`,
      verdict: "deferred",
    });
    return c.json({ id: row?.id, moderation_status: "Pending Review", deferred: true }, 202);
  }

  let verdict:
    | z.infer<typeof remedyModerationOutputSchema>
    | null = null;
  let modelUsed = "";
  let usageInput = 0;
  let usageOutput = 0;
  let errorCode: string | null = null;

  try {
    const res = await chatJson({
      system,
      user: userMsg,
      temperature: 0.15,
      parse: (obj) => remedyModerationOutputSchema.parse(obj),
    });
    verdict = res.json;
    modelUsed = res.model;
    usageInput = res.usage.input_tokens;
    usageOutput = res.usage.output_tokens;
    // Filter references server-side (F4).
    verdict.draft.research_references = filterCitedReferences(
      verdict.draft.research_references,
      searchOutcome.results,
    );
  } catch (err) {
    errorCode =
      err instanceof GroqError ? err.code : err instanceof z.ZodError ? "invalid_json" : "internal";
  }

  await recordUsage({
    endpoint: "submission-remedy",
    model: modelUsed || "unknown",
    inputTokens: usageInput || estTokens,
    outputTokens: usageOutput,
  });

  // Persist the submission with whatever we got.
  const [saved] = (await db
    .insert(remedySubmissions)
    .values({
      herbs_used: [input.primary_herb_name, ...(input.herbs_used ?? [])],
      health_condition: input.health_condition,
      preparation_method: input.preparation_method,
      dosage: input.dosage ?? null,
      duration_of_use: input.duration_of_use ?? null,
      observed_effects: input.observed_effects,
      submitter_name: input.submitter_name ?? null,
      submitter_contact: input.submitter_contact ?? null,
      moderation_status: verdict?.moderation_status ?? "Pending Review",
      ai_feedback: verdict?.ai_feedback ?? `AI moderation unavailable (${errorCode})`,
      risk_level: verdict?.risk_level ?? null,
      expert_review_required:
        verdict?.expert_review_required ?? !verdict,
      draft_payload: (verdict?.draft ?? null) as never,
      ready_to_publish: verdict?.moderation_status === "Approved",
      references_pending_review: true,
      created_by: user.email,
    })
    .returning()) as unknown as Array<{ id: string }>;

  await logEvent({
    endpoint: "submission-remedy",
    userEmail: user.email,
    submissionId: saved?.id ?? null,
    inputHash,
    verdict: verdict?.moderation_status ?? "deferred",
    model: modelUsed || null,
    provider: "groq",
    searchProvider: searchOutcome.provider,
    inputTokens: usageInput,
    outputTokens: usageOutput,
    errorCode,
    summary: verdict
      ? { risk_level: verdict.risk_level, refs: verdict.draft.research_references.length }
      : null,
  });

  return c.json({
    id: saved?.id,
    moderation_status: verdict?.moderation_status ?? "Pending Review",
    ready_to_publish: verdict?.moderation_status === "Approved",
    ai_feedback: verdict?.ai_feedback ?? "Awaiting review",
    references_pending_review: true,
    deferred: !verdict,
  });
});

// ---------------------------------------------------------------------------
// Herb submission — same shape, different table + prompt
// ---------------------------------------------------------------------------

submissionRoutes.post("/herb", async (c) => {
  const user = c.get("user");
  const isAgent = !!c.req.header("x-agent-service-token");
  const body = await c.req.json().catch(() => ({}));
  const parsed = herbSubmissionInputSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => i.message).join("; "),
      cause: { code: "invalid_body" },
    });
  }
  const input = parsed.data;

  if (!isAgent) {
    const rl = await checkAndConsume("submissions", user.email);
    if (!rl.ok) {
      c.header("Retry-After", String(rl.retryAfterSeconds));
      throw new HTTPException(429, {
        message: rl.message,
        cause: { code: "rate_limited" },
      });
    }
  }

  const searchQuery = `"${input.common_name}" ${input.botanical_name ?? ""} drug interactions contraindications research`;
  const searchOutcome = await search(searchQuery);

  const { system, user: userMsg } = buildHerbModerationPrompt(input, searchOutcome.results);
  const estTokens = estimateChatTokens([
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ]);
  const inputHash = hashInput("submission-herb", input);

  const db = getDb();
  const budget = await reserveBudget(estTokens);
  if (!budget.ok) {
    const [row] = (await db
      .insert(herbSubmissions)
      .values({
        common_name: input.common_name,
        botanical_name: input.botanical_name ?? null,
        description: input.description,
        region: input.region ?? null,
        category: input.category ?? null,
        submitter_name: input.submitter_name ?? null,
        submitter_contact: input.submitter_contact ?? null,
        moderation_status: "Pending Review",
        ai_feedback: `Deferred: LLM budget exhausted (${budget.code}).`,
        expert_review_required: true,
        draft_payload: null,
        ready_to_publish: false,
        references_pending_review: true,
        created_by: user.email,
      })
      .returning()) as unknown as Array<{ id: string }>;
    await logEvent({
      endpoint: "submission-herb",
      userEmail: user.email,
      submissionId: row?.id ?? null,
      inputHash,
      errorCode: `budget_${budget.code}`,
      verdict: "deferred",
    });
    return c.json({ id: row?.id, moderation_status: "Pending Review", deferred: true }, 202);
  }

  let verdict:
    | z.infer<typeof herbModerationOutputSchema>
    | null = null;
  let modelUsed = "";
  let usageInput = 0;
  let usageOutput = 0;
  let errorCode: string | null = null;

  try {
    const res = await chatJson({
      system,
      user: userMsg,
      temperature: 0.15,
      parse: (obj) => herbModerationOutputSchema.parse(obj),
    });
    verdict = res.json;
    modelUsed = res.model;
    usageInput = res.usage.input_tokens;
    usageOutput = res.usage.output_tokens;
    verdict.draft.research_references = filterCitedReferences(
      verdict.draft.research_references,
      searchOutcome.results,
    );
  } catch (err) {
    errorCode =
      err instanceof GroqError ? err.code : err instanceof z.ZodError ? "invalid_json" : "internal";
  }

  await recordUsage({
    endpoint: "submission-herb",
    model: modelUsed || "unknown",
    inputTokens: usageInput || estTokens,
    outputTokens: usageOutput,
  });

  const [saved] = (await db
    .insert(herbSubmissions)
    .values({
      common_name: input.common_name,
      botanical_name: input.botanical_name ?? null,
      description: input.description,
      region: input.region ?? null,
      category: input.category ?? null,
      submitter_name: input.submitter_name ?? null,
      submitter_contact: input.submitter_contact ?? null,
      moderation_status: verdict?.moderation_status ?? "Pending Review",
      ai_feedback: verdict?.ai_feedback ?? `AI moderation unavailable (${errorCode})`,
      risk_level: verdict?.risk_level ?? null,
      expert_review_required: verdict?.expert_review_required ?? !verdict,
      draft_payload: (verdict?.draft ?? null) as never,
      ready_to_publish: verdict?.moderation_status === "Approved",
      references_pending_review: true,
      created_by: user.email,
    })
    .returning()) as unknown as Array<{ id: string }>;

  await logEvent({
    endpoint: "submission-herb",
    userEmail: user.email,
    submissionId: saved?.id ?? null,
    inputHash,
    verdict: verdict?.moderation_status ?? "deferred",
    model: modelUsed || null,
    provider: "groq",
    searchProvider: searchOutcome.provider,
    inputTokens: usageInput,
    outputTokens: usageOutput,
    errorCode,
    summary: verdict
      ? { risk_level: verdict.risk_level, refs: verdict.draft.research_references.length }
      : null,
  });

  return c.json({
    id: saved?.id,
    moderation_status: verdict?.moderation_status ?? "Pending Review",
    ready_to_publish: verdict?.moderation_status === "Approved",
    ai_feedback: verdict?.ai_feedback ?? "Awaiting review",
    references_pending_review: true,
    deferred: !verdict,
  });
});

// ---------------------------------------------------------------------------
// Admin publish — takes the stored draft, allows overrides, inserts the
// real Herb/Remedy row inside a transaction.
// ---------------------------------------------------------------------------

function requireAdmin(c: Context<{ Variables: Variables }>) {
  const u = c.get("user");
  if (u.role !== "admin") {
    throw new HTTPException(403, {
      message: "Admin only",
      cause: { code: "forbidden" },
    });
  }
  return u;
}

submissionRoutes.post("/remedy/:id/publish", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const overrides = ((await c.req.json().catch(() => ({}))) as Record<string, unknown>) ?? {};

  const db = getDb();
  const [sub] = await db
    .select()
    .from(remedySubmissions)
    .where(eq(remedySubmissions.id, id))
    .limit(1);
  if (!sub) throw new HTTPException(404, { message: "Submission not found" });
  if (!sub.draft_payload) {
    throw new HTTPException(400, { message: "Submission has no draft payload to publish" });
  }

  const draft: Record<string, unknown> = (sub.draft_payload ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...draft, ...overrides };

  const created = await withTransaction(async (tx) => {
    const values = {
      ...merged,
      submitted_by: sub.created_by ?? null,
      approved_by_ai: true,
      featured: false,
      created_by: sub.created_by,
    };
    const [inserted] = await tx
      .insert(remedies)
      .values(values as never)
      .returning();
    await tx
      .update(remedySubmissions)
      .set({
        moderation_status: "Approved",
        ready_to_publish: false,
        published_remedy_id: (inserted as { id: string }).id,
        references_pending_review: false,
        updated_date: sql`now()`,
      })
      .where(eq(remedySubmissions.id, id));
    return inserted;
  });
  return c.json(created, 201);
});

submissionRoutes.post("/herb/:id/publish", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const overrides = ((await c.req.json().catch(() => ({}))) as Record<string, unknown>) ?? {};

  const db = getDb();
  const [sub] = await db
    .select()
    .from(herbSubmissions)
    .where(eq(herbSubmissions.id, id))
    .limit(1);
  if (!sub) throw new HTTPException(404, { message: "Submission not found" });
  if (!sub.draft_payload) {
    throw new HTTPException(400, { message: "Submission has no draft payload to publish" });
  }

  const draft: Record<string, unknown> = (sub.draft_payload ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...draft, ...overrides };

  const created = await withTransaction(async (tx) => {
    const values = {
      ...merged,
      submitted_by: sub.created_by ?? null,
      community_contributed: true,
      featured: false,
      created_by: sub.created_by,
    };
    const [inserted] = await tx
      .insert(herbs)
      .values(values as never)
      .returning();
    await tx
      .update(herbSubmissions)
      .set({
        moderation_status: "Approved",
        ready_to_publish: false,
        published_herb_id: (inserted as { id: string }).id,
        references_pending_review: false,
        updated_date: sql`now()`,
      })
      .where(eq(herbSubmissions.id, id));
    return inserted;
  });
  return c.json(created, 201);
});
