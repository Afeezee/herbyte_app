/**
 * Prompts the agent uses to pick a herb/remedy and draft the baseline
 * submission payload. The downstream /api/submissions/{herb,remedy}
 * route runs the real moderation + enrichment prompt on top of this;
 * the agent only produces the baseline input a human submitter would
 * type into the form.
 */
import type { Category, HealthCondition, Region } from "./diversity";
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
  /** When set, pin the herb — don't pick, generate the entry for THIS herb. */
  fixedCommonName?: string | null;
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

  const parts: string[] = [];
  if (opts.fixedCommonName) {
    parts.push(
      `Brief: produce the Herbyte entry for the specific herb **${opts.fixedCommonName}**.`,
      `common_name MUST be exactly "${opts.fixedCommonName}" (or the correct canonical variant if the user typed a close name).`,
      `Fill in botanical_name, description, region (default to **${opts.region}** if it fits), and category (default to **${opts.category}** if it fits — otherwise pick the one that actually matches this herb).`,
    );
  } else {
    parts.push(
      `Brief: pick ONE herb primarily used in **${opts.region}** herbal tradition that fits the **${opts.category}** category.`,
      `Avoid repeating any of these already-covered herbs (match on common OR botanical name):`,
      opts.avoid.length ? opts.avoid.map((n) => `  - ${n}`).join("\n") : "  (none yet)",
    );
  }
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
  /** Primary herbs already used by one or more existing remedies — pick a different star herb. */
  avoidPrimaryHerbs?: string[];
  /** Specific health condition this remedy MUST target. */
  targetCondition?: HealthCondition | null;
  /** When set, pin the primary herb — the remedy MUST use this as its star herb. */
  fixedPrimary?: string | null;
  researchResults?: SearchResult[] | null;
}): { system: string; user: string } {
  const system = `You are a research-oriented herbalist curator for Herbyte. Draft ONE community-remedy entry that fits the brief.

${safetyInstruction}

Field rules:
- "herbs_used" MUST include the primary herb AND 0–4 companion herbs. Never return it empty.
- "preparation_method" and "observed_effects" MUST be real multi-sentence text, not placeholders.

JSON schema:
{
  "name": string,                     // short descriptive name of the remedy
  "primary_herb_name": string,        // the main herb
  "herbs_used": string[],             // ALL herbs in the remedy, primary first, 1–5 total
  "health_condition": string,         // the ailment it addresses (short noun phrase)
  "preparation_method": string,       // 2–6 sentences of instructions
  "dosage": string,                   // e.g. "1 cup twice daily, up to 14 days"
  "duration_of_use": string,          // e.g. "up to 2 weeks"
  "observed_effects": string          // what folk use expects to see
}`;

  const parts: string[] = [];
  if (opts.fixedPrimary) {
    parts.push(
      `Brief: produce a remedy whose star herb is **${opts.fixedPrimary}**.`,
      `primary_herb_name MUST be "${opts.fixedPrimary}" (or the correct canonical variant). The remedy should showcase this herb.`,
    );
    if (opts.targetCondition) {
      parts.push(
        `Target the specific health condition **${opts.targetCondition}** if ${opts.fixedPrimary} is traditionally used for it. If not a good fit, pick another condition this herb IS known for.`,
      );
    }
    parts.push(
      `Use region = **${opts.region}** if ${opts.fixedPrimary} is grown or used there; otherwise pick the region that fits.`,
    );
    // Dedup still useful — avoid producing the EXACT same remedy name
    // that already exists for this herb.
    if (opts.avoid.length) {
      parts.push("", `Avoid naming it identically to any existing remedy:`);
      parts.push(opts.avoid.slice(0, 20).map((n) => `  - ${n}`).join("\n"));
    }
  } else if (opts.targetCondition) {
    parts.push(
      `Brief: a remedy from the **${opts.region}** herbal tradition targeting the specific condition **${opts.targetCondition}**.`,
      `The health_condition field in your output MUST describe this condition. The category (${opts.category}) is secondary — if a different category fits the condition better, use the one that fits.`,
    );
    parts.push(
      `Avoid repeating any of these already-covered remedies:`,
      opts.avoid.length ? opts.avoid.map((n) => `  - ${n}`).join("\n") : "  (none yet)",
    );
    if (opts.avoidPrimaryHerbs && opts.avoidPrimaryHerbs.length) {
      parts.push("");
      parts.push("ALSO AVOID picking any of these primary herbs — they are already heavily used in existing remedies. Choose a different star herb:");
      parts.push(opts.avoidPrimaryHerbs.map((n) => `  - ${n}`).join("\n"));
    }
  } else {
    parts.push(`Brief: a remedy from the **${opts.region}** herbal tradition that fits the **${opts.category}** category.`);
    parts.push(
      `Avoid repeating any of these already-covered remedies:`,
      opts.avoid.length ? opts.avoid.map((n) => `  - ${n}`).join("\n") : "  (none yet)",
    );
    if (opts.avoidPrimaryHerbs && opts.avoidPrimaryHerbs.length) {
      parts.push("");
      parts.push("ALSO AVOID picking any of these primary herbs — they are already heavily used in existing remedies. Choose a different star herb:");
      parts.push(opts.avoidPrimaryHerbs.map((n) => `  - ${n}`).join("\n"));
    }
  }
  if (opts.researchResults) {
    parts.push("");
    parts.push("Ground the entry in these fresh search snippets. Prefer a remedy the snippets actually describe:");
    parts.push(searchBlock(opts.researchResults));
  }
  parts.push("");
  parts.push("Return ONLY the JSON object.");
  return { system, user: parts.join("\n") };
}
