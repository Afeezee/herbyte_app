import { getDb } from "../db";
import { moderationEvents } from "../schema";

/**
 * Non-blocking audit log. Never throws — logging failure must not fail the
 * request. Do NOT log full free-text health input here; a small summary
 * (verdict, risk_level, tokens) is enough for later analysis.
 */
export async function logEvent(params: {
  endpoint: string;
  userEmail?: string | null;
  submissionId?: string | null;
  inputHash?: string | null;
  verdict?: string | null;
  model?: string | null;
  provider?: string | null;
  searchProvider?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  errorCode?: string | null;
  summary?: unknown;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(moderationEvents).values({
      endpoint: params.endpoint,
      user_email: params.userEmail ?? null,
      submission_id: params.submissionId ?? null,
      input_hash: params.inputHash ?? null,
      verdict: params.verdict ?? null,
      model: params.model ?? null,
      provider: params.provider ?? null,
      search_provider: params.searchProvider ?? null,
      input_tokens: params.inputTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      error_code: params.errorCode ?? null,
      summary: (params.summary ?? null) as never,
    });
  } catch (err) {
    console.error("[moderation_events] insert failed", err);
  }
}
