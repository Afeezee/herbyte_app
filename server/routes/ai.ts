/**
 * Four advice endpoints:
 *   POST /api/ai/assistant
 *   POST /api/ai/herb-insight
 *   POST /api/ai/remedy-insight
 *   POST /api/ai/search-suggestions
 *
 * Each one runs the same pipeline:
 *   1. Zod-validate input
 *   2. Per-user rate limit
 *   3. Cache lookup by content hash
 *   4. Budget reservation
 *   5. Groq call with system/user split
 *   6. Zod-validate response, one repair retry inside groq.ts
 *   7. Store in cache; record usage; log a moderation_events row
 *
 * On any failure past the rate-limit stage, return a friendly
 * `{error:{code:"ai_unavailable",message:...}}`. The frontend's existing
 * catch blocks already display an alert on error; phase 7 wires them to a
 * proper inline message.
 */
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { reserveBudget, recordUsage } from "../ai/budget";
import { hashInput, readCache, writeCache } from "../ai/cache";
import { checkAndConsume } from "../ai/rate-limit";
import { chatJson, GroqError, estimateChatTokens } from "../ai/groq";
import { logEvent } from "../ai/events";
import {
  assistantInputSchema,
  assistantResponseSchema,
  buildAssistantPrompt,
  buildHerbInsightPrompt,
  buildRemedyInsightPrompt,
  buildSearchSuggestionsPrompt,
  herbInsightInputSchema,
  herbInsightResponseSchema,
  remedyInsightInputSchema,
  remedyInsightResponseSchema,
  searchSuggestionsInputSchema,
  searchSuggestionsResponseSchema,
} from "../ai/prompts";
import type { Variables } from "../router";

export const aiRoutes = new Hono<{ Variables: Variables }>();

type RunOptions<In, Out> = {
  endpoint: string;
  rateLimitKey: string;
  input: In;
  inputSchema: z.ZodSchema<In>;
  outputSchema: z.ZodSchema<Out>;
  buildPrompt: (input: In) => { system: string; user: string };
  temperature?: number;
  cacheTtlSeconds?: number;
};

async function runAdvice<In, Out>(
  c: Context<{ Variables: Variables }>,
  opts: RunOptions<In, Out>,
): Promise<Response> {
  const user = c.get("user");
  const parsed = opts.inputSchema.safeParse(opts.input);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => i.message).join("; "),
      cause: { code: "invalid_body" },
    });
  }
  const input = parsed.data;

  const rl = await checkAndConsume(opts.rateLimitKey, user.email);
  if (!rl.ok) {
    c.header("Retry-After", String(rl.retryAfterSeconds));
    throw new HTTPException(429, {
      message: rl.message,
      cause: { code: "rate_limited" },
    });
  }

  const inputHash = hashInput(opts.endpoint, input);

  const cached = await readCache<Out>(opts.endpoint, inputHash);
  if (cached) {
    await logEvent({
      endpoint: opts.endpoint,
      userEmail: user.email,
      inputHash,
      verdict: "cache_hit",
    });
    return c.json({ ...cached, __cached: true } as never);
  }

  const { system, user: userMsg } = opts.buildPrompt(input);
  const estTokens = estimateChatTokens([
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ]);

  const budget = await reserveBudget(estTokens);
  if (!budget.ok) {
    await logEvent({
      endpoint: opts.endpoint,
      userEmail: user.email,
      inputHash,
      errorCode: `budget_${budget.code}`,
    });
    c.header("Retry-After", String(budget.retryAfterSeconds));
    throw new HTTPException(503, {
      message: "AI service temporarily unavailable due to daily/hourly budget limits.",
      cause: { code: "ai_unavailable" },
    });
  }

  try {
    const result = await chatJson({
      system,
      user: userMsg,
      temperature: opts.temperature ?? 0.2,
      parse: (obj) => opts.outputSchema.parse(obj),
    });
    await recordUsage({
      endpoint: opts.endpoint,
      model: result.model,
      inputTokens: result.usage.input_tokens || estTokens,
      outputTokens: result.usage.output_tokens || 0,
    });
    await writeCache(opts.endpoint, inputHash, result.json, opts.cacheTtlSeconds);
    await logEvent({
      endpoint: opts.endpoint,
      userEmail: user.email,
      inputHash,
      model: result.model,
      provider: "groq",
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      verdict: "ok",
    });
    return c.json(result.json as never);
  } catch (err) {
    const code =
      err instanceof GroqError ? err.code : err instanceof z.ZodError ? "invalid_json" : "internal";
    await logEvent({
      endpoint: opts.endpoint,
      userEmail: user.email,
      inputHash,
      errorCode: code,
    });
    throw new HTTPException(503, {
      message: "AI service is unavailable right now. Please try again in a moment.",
      cause: { code: "ai_unavailable" },
    });
  }
}

// ---------------------------------------------------------------------------

aiRoutes.post("/assistant", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return runAdvice(c, {
    endpoint: "ai-assistant",
    rateLimitKey: "ai-assistant",
    input: body,
    inputSchema: assistantInputSchema,
    outputSchema: assistantResponseSchema,
    buildPrompt: buildAssistantPrompt,
    temperature: 0.3,
  });
});

aiRoutes.post("/herb-insight", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return runAdvice(c, {
    endpoint: "ai-herb-insight",
    rateLimitKey: "ai-herb-insight",
    input: body,
    inputSchema: herbInsightInputSchema,
    outputSchema: herbInsightResponseSchema,
    buildPrompt: buildHerbInsightPrompt,
    temperature: 0.15,
  });
});

aiRoutes.post("/remedy-insight", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return runAdvice(c, {
    endpoint: "ai-remedy-insight",
    rateLimitKey: "ai-remedy-insight",
    input: body,
    inputSchema: remedyInsightInputSchema,
    outputSchema: remedyInsightResponseSchema,
    buildPrompt: buildRemedyInsightPrompt,
    temperature: 0.15,
  });
});

aiRoutes.post("/search-suggestions", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return runAdvice(c, {
    endpoint: "ai-search-suggestions",
    rateLimitKey: "ai-search-suggestions",
    input: body,
    inputSchema: searchSuggestionsInputSchema,
    outputSchema: searchSuggestionsResponseSchema,
    buildPrompt: buildSearchSuggestionsPrompt,
    temperature: 0.4,
    cacheTtlSeconds: 60 * 60 * 12, // suggestions are cheap to cache longer
  });
});
