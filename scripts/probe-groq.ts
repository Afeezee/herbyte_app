/**
 * Throwaway probe: verifies Groq JSON mode support, presence of
 * <think>…</think> reasoning blocks, and measures real tokens for the
 * heaviest prompt (submission moderation) and a light one (search
 * suggestions). Run with `npm run probe:groq` after setting GROQ_API_KEY.
 *
 * Prints a report; put it in MIGRATION_REPORT.md.
 */
import "dotenv/config";
import { getEnv, _resetEnvForTests } from "../server/env";

if (!process.env.GROQ_API_KEY) {
  console.log("GROQ_API_KEY not set — skipping probe.");
  process.exit(0);
}

_resetEnvForTests();
const env = getEnv();

type Result = {
  label: string;
  model: string;
  jsonMode: boolean;
  hadThink: boolean;
  inputTokens: number;
  outputTokens: number;
  parseOk: boolean;
};

async function run(
  label: string,
  system: string,
  user: string,
  jsonMode: boolean,
): Promise<Result> {
  const body = {
    model: env.AI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_completion_tokens: 2048,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[${label}] HTTP ${res.status}: ${text}`);
    process.exit(2);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const hadThink = /<think>[\s\S]*?<\/think>/i.test(content);
  let parseOk = false;
  try {
    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    const jsonStr = first !== -1 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    JSON.parse(jsonStr);
    parseOk = true;
  } catch {
    parseOk = false;
  }
  return {
    label,
    model: env.AI_MODEL,
    jsonMode,
    hadThink,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    parseOk,
  };
}

const heavySystem =
  "You are an expert herbalist. Reply ONLY with a JSON object matching the schema. Never wrap in code fences or add prose.";
const heavyUser = `Review the following community-submitted remedy for safety, evidence and enrichment.

Submission (untrusted user input):
- Herbs used: ["ginger", "turmeric"]
- Health condition: chronic joint pain from arthritis
- Preparation method: Boil sliced ginger and turmeric in 500ml water for 10 minutes, add honey.
- Dosage: 1 cup twice daily
- Duration: 4 weeks
- Observed effects: reduced pain after 2 weeks

Return a JSON object with fields: moderation_status ("Approved"|"Flagged - Risk Identified"|"Rejected"), ai_feedback (string), risk_level ("Low"|"Moderate"|"High"|"Critical"), enriched_description, dosage_note, contraindications (array of string), drug_interactions (array of string), safety_rating ("Generally Safe"|"Use with Caution"|"High Risk - Expert Guidance Required"), research_references (array of {title,url,source}).`;

const lightSystem =
  "You are a search-suggestion assistant. Reply ONLY with a JSON object of shape {\"suggestions\": string[]} with 3-5 short items.";
const lightUser = "The user's search query is: 'sleep'";

async function main() {
  const results: Result[] = [];
  results.push(await run("light+json_mode", lightSystem, lightUser, true));
  results.push(await run("light+prompted_json", lightSystem, lightUser, false));
  results.push(await run("heavy+json_mode", heavySystem, heavyUser, true));
  results.push(await run("heavy+prompted_json", heavySystem, heavyUser, false));

  console.log("Groq probe results");
  console.log("==================");
  for (const r of results) {
    console.log(`- ${r.label}`);
    console.log(`    model=${r.model}`);
    console.log(`    json_mode=${r.jsonMode}  parse_ok=${r.parseOk}  had_think=${r.hadThink}`);
    console.log(`    tokens: input=${r.inputTokens} output=${r.outputTokens}`);
  }

  const heavy = results.find((r) => r.label === "heavy+json_mode");
  if (heavy) {
    const perCall = heavy.inputTokens + heavy.outputTokens;
    if (perCall > 0) {
      const perDay = Math.floor(env.GROQ_TPD_CEILING / perCall);
      console.log(`\nAt ${perCall} tokens per heavy call and ${env.GROQ_TPD_CEILING} TPD ceiling,`);
      console.log(`≈ ${perDay} heavy calls/day.`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
