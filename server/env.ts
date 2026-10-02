import { z } from "zod";

const trimmed = z.string().trim().min(1);
const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const emailList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

const positiveInt = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return fallback;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return fallback;
      return Math.floor(n);
    });

const schema = z.object({
  // Database
  DATABASE_URL: trimmed,
  DATABASE_URL_UNPOOLED: optionalTrimmed,

  // Clerk — optional so the content agent (which doesn't call Clerk)
  // can boot without it. API routes that need Clerk will throw on first
  // use with a clear message.
  CLERK_SECRET_KEY: optionalTrimmed,
  CLERK_WEBHOOK_SECRET: optionalTrimmed,

  // Groq
  GROQ_API_KEY: optionalTrimmed,
  AI_MODEL: z.string().default("qwen/qwen3.8-27b"),
  AI_FALLBACK_MODEL: optionalTrimmed,
  GROQ_RPM_CEILING: positiveInt(25),
  GROQ_TPM_CEILING: positiveInt(7000),
  GROQ_TPD_CEILING: positiveInt(180000),

  // Search grounding
  SERPER_API_KEY: optionalTrimmed,
  TAVILY_API_KEY: optionalTrimmed,
  SEARCH_DAILY_CEILING: positiveInt(40),

  // Blob
  BLOB_READ_WRITE_TOKEN: optionalTrimmed,

  // Email
  RESEND_API_KEY: optionalTrimmed,
  CONTACT_TO_EMAIL: z.string().email().default("hello@herbyte.com"),

  // Admin bootstrap
  ADMIN_EMAILS: emailList,

  // Cron secret
  CRON_SECRET: optionalTrimmed,

  // Content agent — service token for the generator script to submit as
  // a specific user. When both are set, requests carrying
  // `X-Agent-Service-Token: <AGENT_SERVICE_TOKEN>` are authenticated as
  // AGENT_AUTHOR_EMAIL instead of going through Clerk.
  AGENT_SERVICE_TOKEN: optionalTrimmed,
  AGENT_AUTHOR_EMAIL: optionalTrimmed,
  AGENT_AUTHOR_NAME: optionalTrimmed,

  // Unsplash — stock photos for agent-generated herb/remedy entries.
  UNSPLASH_ACCESS_KEY: optionalTrimmed,

  // Content agent limits (easy to override in Vercel / local env).
  AGENT_DAILY_CAP: positiveInt(12),
  AGENT_RESEARCH_RATIO: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return 0.5;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 1) return 0.5;
      return n;
    }),

  // Legacy media rehost source host
  LEGACY_MEDIA_HOST: z.string().default("base44.app"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

// Test-only: reset cached env so tests can mutate process.env between cases.
export function _resetEnvForTests(): void {
  cached = undefined;
}
