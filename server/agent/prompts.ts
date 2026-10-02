/**
 * Prompts the agent uses to pick a herb/remedy and draft the baseline
 * submission payload. The downstream /api/submissions/{herb,remedy}
 * route runs the real moderation + enrichment prompt on top of this;
 * the agent only produces the baseline input a human submitter would
 * type into the form.
 */
import type { Category, Region } from "./diversity";
import type { SearchResult } from "../ai/search";

const safetyInstruction = `Rules:
- Do NOT assert medical efficacy. Phrase uses as "traditionally used for", "has long been drunk as a tonic for", etc.
- Keep claims within the realm of folk / traditional / ethnobotanical use. The downstream moderator will add drug interactions and safety ratings.
- Prefer well-established plants with documented traditional use. Do not invent cultivars.
- Reply with ONLY a single JSON object matching the schema. No prose, no code fences, no <think>.`;

function searchBlock(results: SearchResult[]): string {
  if (!results.length) return "(no results)";
  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet.slice(0, 320)}`,
    )
    .join("\n");
}

export function buildHerbChoicePrompt(opts: {
  category: Category;
  region: Region;
  avoid: string[];
  researchResults?: SearchResult[] | null;
}): { system: string; user: string } {
  const system = `You are a research-oriented herbalist curator for Herbyte, a herbal-medicine reference site. Pick ONE herb that fits the brief and draft a short, honest baseline entry.

${safetyInstruction}

JSON schema:
{
  "common_name": string,              // the usual name people search for
  "botanical_name": string,           // Latin binomial
  "description": string,              // 2–4 sentences, 60–400 words
  "region": "${opts.region}",         // echo back
  "category": "${opts.category}"      // echo back
}`;

  const parts: string[] = [
    `Brief: pick ONE herb primarily used in **${opts.region}** herbal tradition that fits the **${opts.category}** category.`,
    `Avoid repeating any of these already-covered herbs (match on common OR botanical name):`,
    opts.avoid.length ? opts.avoid.map((n) => `  - ${n}`).join("\n") : "  (none yet)",
  ];
  if (opts.researchResults) {
    parts.push("");
    parts.push("Ground the entry in these fresh search snippets. Prefer a herb the snippets actually discuss:");
    parts.push(searchBlock(opts.researchResults));
  }
  parts.push("");
  parts.push("Return ONLY the JSON object.");
  return { system, user: parts.join("\n") };
}

export function buildRemedyChoicePrompt(opts: {
  category: Category;
  region: Region;
  avoid: string[];
  researchResults?: SearchResult[] | null;
}): { system: string; user: string } {
  const system = `You are a research-oriented herbalist curator for Herbyte. Draft ONE community-remedy entry that fits the brief.

${safetyInstruction}

JSON schema:
{
  "name": string,                     // short descriptive name of the remedy
  "primary_herb_name": string,        // the main herb
  "herbs_used": string[],             // other herbs included, 0–4
  "health_condition": string,         // the ailment it addresses (short noun phrase)
  "preparation_method": string,       // 2–6 sentences of instructions
  "dosage": string,                   // e.g. "1 cup twice daily, up to 14 days"
  "duration_of_use": string,          // e.g. "up to 2 weeks"
  "observed_effects": string          // what folk use expects to see
}`;

  const parts: string[] = [
    `Brief: a remedy from the **${opts.region}** herbal tradition that fits the **${opts.category}** category.`,
    `Avoid repeating any of these already-covered remedies:`,
    opts.avoid.length ? opts.avoid.map((n) => `  - ${n}`).join("\n") : "  (none yet)",
  ];
  if (opts.researchResults) {
    parts.push("");
    parts.push("Ground the entry in these fresh search snippets. Prefer a remedy the snippets actually describe:");
    parts.push(searchBlock(opts.researchResults));
  }
  parts.push("");
  parts.push("Return ONLY the JSON object.");
  return { system, user: parts.join("\n") };
}
