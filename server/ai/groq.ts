/**
 * Groq client (OpenAI-compatible /chat/completions endpoint). Behind a
 * small provider interface so the model can be swapped when qwen3.8-27b is
 * withdrawn (Preview model — see section 6 of the migration prompt).
 *
 * Handles:
 * - JSON extraction from responses that wrap the payload in
 *   ```json fences``` or emit a leading <think>…</think> block.
 * - One repair retry on invalid JSON with a nudge.
 * - Model fallback: on 4xx/5xx from the primary, try AI_FALLBACK_MODEL if
 *   set.
 * - Estimated token counting (4 chars ≈ 1 token) for the budget check
 *   BEFORE the call; actual token counts come from the Groq response.
 */
import { getEnv } from "../env";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 30_000;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResponse<T = unknown> = {
  json: T;
  raw: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

export class GroqError extends Error {
  constructor(
    public code:
      | "no_api_key"
      | "http_error"
      | "timeout"
      | "invalid_json"
      | "no_model",
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "GroqError";
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateChatTokens(messages: ChatMessage[]): number {
  return messages.reduce((n, m) => n + estimateTokens(m.content) + 8, 0);
}

async function callOnce({
  model,
  messages,
  temperature,
  responseJson,
  signal,
}: {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  responseJson: boolean;
  signal?: AbortSignal;
}): Promise<{ raw: string; usage: { input_tokens: number; output_tokens: number } }> {
  const env = getEnv();
  if (!env.GROQ_API_KEY) throw new GroqError("no_api_key", "GROQ_API_KEY not set");

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    // Groq caps completion tokens; give a healthy but bounded budget.
    max_completion_tokens: 4096,
  };
  if (responseJson) body.response_format = { type: "json_object" };

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GroqError(
      "http_error",
      `Groq HTTP ${res.status}: ${text.slice(0, 500)}`,
      res.status,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    raw: content,
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Strip <think>…</think> reasoning blocks and ```json fences``` around the
 * payload; return the first {...} block otherwise, else the raw content.
 */
export function extractJson(raw: string): string {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1]!.trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return s.trim();
}

export async function chatJson<T>({
  system,
  user,
  temperature = 0.2,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  parse,
  jsonMode = true,
}: {
  system: string;
  user: string;
  temperature?: number;
  timeoutMs?: number;
  parse: (obj: unknown) => T;
  jsonMode?: boolean;
}): Promise<ChatResponse<T>> {
  const env = getEnv();
  const models = [env.AI_MODEL, env.AI_FALLBACK_MODEL].filter(
    (m): m is string => !!m,
  );
  if (models.length === 0) throw new GroqError("no_model", "AI_MODEL not set");

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let lastErr: unknown;
  try {
    for (const model of models) {
      try {
        // First attempt.
        let attempt = await callOnce({
          model,
          messages,
          temperature,
          responseJson: jsonMode,
          signal: controller.signal,
        });

        for (let tries = 0; tries < 2; tries++) {
          const jsonStr = extractJson(attempt.raw);
          try {
            const parsed = parse(JSON.parse(jsonStr));
            return { json: parsed, raw: attempt.raw, model, usage: attempt.usage };
          } catch (parseErr) {
            if (tries === 1) {
              const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);
              // Snippet of raw output helps diagnose in moderation_events.
              const snippet = attempt.raw.slice(0, 400).replace(/\s+/g, " ");
              console.error(
                `[groq] parse failed on model=${model} after repair.\n  err: ${detail}\n  raw: ${snippet}`,
              );
              lastErr = new GroqError(
                "invalid_json",
                `Model output did not match schema on ${model}: ${detail}`,
              );
              break;
            }
            // One repair retry — tell the model EXACTLY what went wrong.
            const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);
            const repairMessages: ChatMessage[] = [
              ...messages,
              { role: "assistant", content: attempt.raw },
              {
                role: "user",
                content:
                  `Your previous reply did not parse against the schema. Error: ${detail}\n\n` +
                  `Reply again with ONLY the JSON object — no prose, no <think>, no code fences — ` +
                  `and ensure every required field is present and every enum uses an allowed value.`,
              },
            ];
            attempt = await callOnce({
              model,
              messages: repairMessages,
              temperature,
              responseJson: jsonMode,
              signal: controller.signal,
            });
          }
        }
      } catch (err) {
        lastErr = err;
        // Try the next model.
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new GroqError("http_error", "Unknown Groq error");
  } finally {
    clearTimeout(timer);
  }
}
