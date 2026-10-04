/**
 * One-time (or occasional) review of safety_rating on agent-generated
 * herbs and remedies. Upgrades "Use with Caution" entries whose primary
 * herb is a well-established culinary / dietary ingredient to
 * "Generally Safe" — reflecting the policy that comparable-to-common-
 * food herbs should default to Generally Safe and Use with Caution
 * should be reserved for herbs with a NAMED specific risk.
 *
 * Only touches agent_generated = true entries. Only moves rows UP the
 * tiers (Caution → Safe), never down. High Risk entries are left alone.
 *
 * Usage:
 *   npm run review:safety -- --dry-run     # report what would change
 *   npm run review:safety                  # apply the changes
 *   npm run review:safety -- --live        # alias for applying
 */
import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../server/schema";

type Mode = { dryRun: boolean };

function parseCli(): Mode {
  const args = process.argv.slice(2);
  return { dryRun: args.includes("--dry-run") };
}

/**
 * Well-established culinary / dietary herbs, lower-cased. If the
 * primary herb (or common_name) matches any of these substrings, the
 * entry is a candidate for upgrade.
 *
 * Keep this conservative — only herbs that:
 *  (a) are commonly consumed as foods, teas or cooking spices,
 *  (b) have GRAS or long-standing dietary status,
 *  (c) have no narrow therapeutic window at normal doses.
 */
const CULINARY_SAFE = [
  "chamomile", "ginger", "peppermint", "spearmint", "lemon balm",
  "hibiscus", "rooibos", "rose hip", "rosehip", "rosemary", "thyme",
  "oregano", "basil", "tulsi", "holy basil", "moringa", "turmeric",
  "cardamom", "cinnamon", "fennel", "dandelion", "nettle",
  "hawthorn", "elderberry", "elder flower", "elderflower", "lemon",
  "lime", "garlic", "parsley", "cilantro", "coriander", "dill",
  "lemongrass", "lemon verbena", "lavender", "rose", "olive leaf",
  "burdock", "raspberry leaf", "red raspberry", "mint", "green tea",
  "black tea", "white tea", "sage", "marjoram", "cumin", "clove",
  "anise", "star anise", "nutmeg", "mustard", "chive", "tarragon",
  "bay leaf", "allspice", "paprika", "turnip", "ginseng", "licorice",
  "ashwagandha",
];

/**
 * Word-boundary match (avoids 'rose' matching 'Rhodiola', 'anise' matching
 * 'manisette', etc.). Case-insensitive. Treats comma / parenthesis as
 * separators too so "Rose, hip" or "Tulsi (Holy Basil)" both split cleanly.
 */
function isCulinarySafe(nameOrHerb: string | null | undefined): string | null {
  if (!nameOrHerb) return null;
  const s = nameOrHerb.toLowerCase();
  for (const kw of CULINARY_SAFE) {
    const re = new RegExp(`(^|[^a-z])${kw.replace(/\s+/g, "\\s+")}($|[^a-z])`, "i");
    if (re.test(s)) return kw;
  }
  return null;
}

/**
 * For REMEDIES: only the primary herb drives the safety upgrade.
 * A culinary herb appearing as a minor ingredient (e.g. hibiscus in
 * an Alafia-bark infusion) is not grounds to upgrade — the active
 * star herb has to be the safe one.
 */
function shouldUpgradeRemedy(row: {
  safety_rating: string | null;
  primary_herb_name: string;
}): string | null {
  if (row.safety_rating !== "Use with Caution") return null;
  return isCulinarySafe(row.primary_herb_name);
}

function shouldUpgradeHerb(row: {
  safety_rating: string | null;
  common_name: string;
  botanical_name: string | null;
}): string | null {
  if (row.safety_rating !== "Use with Caution") return null;
  return isCulinarySafe(row.common_name) ?? isCulinarySafe(row.botanical_name);
}

async function main(): Promise<number> {
  const { dryRun } = parseCli();
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set in .env");
    return 1;
  }
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema, casing: "snake_case" });

  console.log(`\nReviewing agent-generated entries (mode: ${dryRun ? "DRY RUN" : "LIVE"})`);
  console.log("─".repeat(72));

  try {
    // Remedies
    const remedies = await db
      .select({
        id: schema.remedies.id,
        name: schema.remedies.name,
        primary_herb_name: schema.remedies.primary_herb_name,
        safety_rating: schema.remedies.safety_rating,
      })
      .from(schema.remedies)
      .where(eq(schema.remedies.agent_generated, true));

    const remedyUpgrades: Array<{ id: string; name: string; match: string }> = [];
    for (const r of remedies) {
      const m = shouldUpgradeRemedy(r);
      if (m) remedyUpgrades.push({ id: r.id, name: r.name, match: m });
    }

    console.log(`\nRemedies: ${remedies.length} total agent-generated, ${remedyUpgrades.length} to upgrade.`);
    for (const u of remedyUpgrades) {
      console.log(`  Caution → Safe   ${u.name}  (matched: ${u.match})`);
    }

    // Herbs
    const herbs = await db
      .select({
        id: schema.herbs.id,
        common_name: schema.herbs.common_name,
        botanical_name: schema.herbs.botanical_name,
        safety_rating: schema.herbs.safety_rating,
      })
      .from(schema.herbs)
      .where(eq(schema.herbs.agent_generated, true));

    const herbUpgrades: Array<{ id: string; name: string; match: string }> = [];
    for (const h of herbs) {
      const m = shouldUpgradeHerb(h);
      if (m) herbUpgrades.push({ id: h.id, name: h.common_name, match: m });
    }

    console.log(`\nHerbs: ${herbs.length} total agent-generated, ${herbUpgrades.length} to upgrade.`);
    for (const u of herbUpgrades) {
      console.log(`  Caution → Safe   ${u.name}  (matched: ${u.match})`);
    }

    // Apply if not dry run.
    if (!dryRun) {
      if (remedyUpgrades.length > 0) {
        await Promise.all(
          remedyUpgrades.map((u) =>
            db
              .update(schema.remedies)
              .set({ safety_rating: "Generally Safe", updated_date: sql`now()` })
              .where(eq(schema.remedies.id, u.id)),
          ),
        );
      }
      if (herbUpgrades.length > 0) {
        await Promise.all(
          herbUpgrades.map((u) =>
            db
              .update(schema.herbs)
              .set({ safety_rating: "Generally Safe", updated_date: sql`now()` })
              .where(eq(schema.herbs.id, u.id)),
          ),
        );
      }
      console.log(`\n✓ Applied: ${remedyUpgrades.length} remedies + ${herbUpgrades.length} herbs upgraded.`);
    } else {
      console.log(`\nDRY RUN — nothing written. Re-run without --dry-run to apply.`);
    }
  } finally {
    await pool.end();
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
