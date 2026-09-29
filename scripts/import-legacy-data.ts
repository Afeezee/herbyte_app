/**
 * Import the legacy JSON exports (one file per entity in
 * ./migration-data) into the new Neon database. Idempotent via
 * legacy_id (a repeated run updates rather than duplicates rows).
 *
 * Usage:
 *   npm run import:data -- --dry-run
 *   npm run import:data
 *   npm run import:data -- --only=Herb,Remedy
 *   npm run import:data -- --include-samples
 *
 * Order of import matters for FK-ish denormalisation (primary_herb_id on
 * Remedy, seller_id on Product, entity_id on Wishlist/Comment) so we
 * follow: users → seller_profiles → herbs → remedies → products →
 * events → comments → remedy_submissions → herb_submissions → wishlists.
 *
 * Every migration decision is recorded in the row itself via `_migration_note`
 * (already present on the provided Herb.json / Remedy.json); the script
 * respects it and strips it before insert.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { and, eq, getTableColumns, isNotNull, sql } from "drizzle-orm";
import * as schema from "../server/schema";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

type CliOpts = {
  dryRun: boolean;
  only: Set<string> | null;
  includeSamples: boolean;
  dataDir: string;
};

function parseCli(): CliOpts {
  const args = process.argv.slice(2);
  const opts: CliOpts = {
    dryRun: false,
    only: null,
    includeSamples: false,
    dataDir: path.resolve(process.cwd(), "migration-data"),
  };
  for (const a of args) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--include-samples") opts.includeSamples = true;
    else if (a.startsWith("--only=")) {
      opts.only = new Set(
        a
          .slice("--only=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (a.startsWith("--data-dir=")) {
      opts.dataDir = path.resolve(process.cwd(), a.slice("--data-dir=".length));
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

type LegacyRow = Record<string, unknown> & { id?: string; is_sample?: boolean };

async function loadFile(dir: string, name: string): Promise<LegacyRow[] | null> {
  const file = path.join(dir, `${name}.json`);
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${file} does not contain a JSON array`);
    }
    return parsed as LegacyRow[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip export-only fields that shouldn't be persisted. */
function stripMeta(row: LegacyRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "_migration_note") continue;
    if (k === "is_sample") continue;
    out[k] = v;
  }
  return out;
}

/** Lowercase an email if present. */
function normEmail(v: unknown): string | null {
  if (typeof v !== "string" || !v.includes("@")) return null;
  return v.trim().toLowerCase();
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A running map of legacy_id → new UUID per table, built during the run.
 * Foreign-key columns that reference other entities (e.g.
 * remedies.primary_herb_id → herbs.id) get their legacy Base44 hex-ish
 * ids translated to real UUIDs through this table.
 */
const legacyToUuid: Record<string, Record<string, string>> = {
  herbs: {},
  remedies: {},
  seller_profiles: {},
  events: {},
  products: {},
  comments: {},
  users: {},
};

/**
 * Which columns on each table reference which other table.
 * Only listed columns are rewritten; anything else in the incoming row is
 * either a real UUID already, an empty string (→ null), or a value that
 * has no local mapping yet (→ null).
 */
const FK_MAP: Record<string, Record<string, string>> = {
  remedies: { primary_herb_id: "herbs" },
  products: {
    seller_id: "seller_profiles",
    linked_remedy_id: "remedies",
  },
  comments: { parent_comment_id: "comments" }, // entity_id handled per-row (polymorphic)
  wishlists: {}, // entity_id polymorphic — best-effort per-row
  seller_profiles: {},
  events: {},
  herbs: {},
};

/**
 * Given a value for a uuid column, return either:
 * - the value unchanged if it's already a valid UUID,
 * - the translated UUID if we have a legacy_id → uuid mapping for it,
 * - null if we can't resolve it (empty string, unknown legacy id).
 */
function resolveUuid(value: unknown, targetTable: string): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (UUID_RE.test(value)) return value;
  return legacyToUuid[targetTable]?.[value] ?? null;
}

// ---------------------------------------------------------------------------
// Per-entity importers. Each returns {inserted, updated, skipped}.
// ---------------------------------------------------------------------------

type Counts = { inserted: number; updated: number; skipped: number };

type Db = ReturnType<typeof drizzle<typeof schema>>;

async function importUsers(db: Db, rows: LegacyRow[], opts: CliOpts): Promise<Counts> {
  const c: Counts = { inserted: 0, updated: 0, skipped: 0 };
  for (const row of rows) {
    if (!opts.includeSamples && row.is_sample) {
      c.skipped++;
      continue;
    }
    const email = normEmail(row.email ?? row.created_by);
    if (!email) {
      c.skipped++;
      continue;
    }
    const values = {
      email,
      full_name: (row.full_name as string | null) ?? (row.name as string | null) ?? null,
      role: (row.role as "user" | "admin") ?? "user",
      is_seller: Boolean(row.is_seller),
      seller_profile_id: (row.seller_profile_id as string | null) ?? null,
      legacy_id: (row.id as string) ?? null,
    };
    if (opts.dryRun) {
      c.inserted++;
      continue;
    }
    const result = await db
      .insert(schema.users)
      .values(values)
      .onConflictDoUpdate({
        target: schema.users.legacy_id,
        set: {
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          is_seller: values.is_seller,
          seller_profile_id: values.seller_profile_id,
          updated_date: sql`now()`,
        },
        setWhere: isNotNull(schema.users.legacy_id),
      })
      .returning({ id: schema.users.id });
    if (result.length > 0) c.inserted++;
    else c.updated++;
  }
  return c;
}

/**
 * Generic upsert. Splits the payload into columns the table actually
 * has, then upserts on `legacy_id`. Columns not on the table are
 * dropped silently — safe against schema drift in the export.
 */
async function upsertGeneric(
  db: Db,
  table: keyof typeof schema,
  tableSqlName: string,
  rows: LegacyRow[],
  opts: CliOpts,
  { legacyIdField = "id", extraDefaults = {} }: {
    legacyIdField?: string;
    extraDefaults?: Record<string, unknown>;
  } = {},
): Promise<Counts> {
  const c: Counts = { inserted: 0, updated: 0, skipped: 0 };
  const tbl = schema[table] as unknown as { legacy_id: unknown };
  const cols = new Set(Object.keys(getTableColumns(schema[table] as never)));
  const fkCols = FK_MAP[tableSqlName] ?? {};

  for (const row of rows) {
    if (!opts.includeSamples && row.is_sample) {
      c.skipped++;
      continue;
    }
    const legacyId = row[legacyIdField];
    if (typeof legacyId !== "string" || legacyId.length === 0) {
      c.skipped++;
      continue;
    }

    const cleaned = stripMeta(row);
    const values: Record<string, unknown> = { ...extraDefaults };
    for (const [k, v] of Object.entries(cleaned)) {
      if (cols.has(k)) values[k] = v;
    }

    // Translate FK columns from legacy hex ids → new UUIDs.
    for (const [fkCol, targetTable] of Object.entries(fkCols)) {
      if (fkCol in values) {
        values[fkCol] = resolveUuid(values[fkCol], targetTable);
      }
    }

    // Polymorphic entity_id (Comment, Wishlist): translate against the
    // right target table based on entity_type. If we can't resolve,
    // skip the row — polymorphic FKs to unresolved entities are useless.
    if ("entity_id" in values && "entity_type" in values) {
      const target = String(values.entity_type ?? "").toLowerCase();
      const map: Record<string, string> = {
        herb: "herbs",
        remedy: "remedies",
        product: "products",
        event: "events",
      };
      const targetTable = map[target];
      if (targetTable) {
        values.entity_id = resolveUuid(values.entity_id, targetTable);
        if (!values.entity_id) {
          c.skipped++;
          continue;
        }
      }
    }

    // Drop the top-level id — Postgres generates a new UUID.
    delete values.id;

    // Lowercase any email-like fields.
    if (typeof values.created_by === "string" && values.created_by.includes("@")) {
      values.created_by = (values.created_by as string).toLowerCase();
    }
    if (typeof values.user_email === "string") {
      values.user_email = (values.user_email as string).toLowerCase();
    }
    if (typeof values.author_email === "string") {
      values.author_email = (values.author_email as string).toLowerCase();
    }
    if (typeof values.organizer_email === "string") {
      values.organizer_email = (values.organizer_email as string).toLowerCase();
    }
    values.legacy_id = legacyId;

    if (opts.dryRun) {
      c.inserted++;
      continue;
    }

    const targetCol = tbl.legacy_id as never;
    // Check for existing row by legacy_id. Two round-trips per row is
    // fine for the 25-row seed we ship with; the alternative
    // (ON CONFLICT on a partial unique index) doesn't cooperate with
    // Drizzle's inference.
    const existing = (await db
      .select({ id: (schema[table] as never as { id: unknown }).id as never })
      .from(schema[table] as never)
      .where(eq(targetCol, legacyId as never))
      .limit(1)) as unknown as Array<{ id: string }>;

    let rowId: string;
    if (existing[0]) {
      const set: Record<string, unknown> = { updated_date: sql`now()` };
      for (const [k, v] of Object.entries(values)) {
        if (k === "legacy_id" || k === "id") continue;
        set[k] = v;
      }
      await db
        .update(schema[table] as never)
        .set(set as never)
        .where(eq(targetCol, legacyId as never));
      rowId = existing[0].id;
      c.updated++;
    } else {
      const inserted = (await db
        .insert(schema[table] as never)
        .values(values as never)
        .returning()) as unknown as Array<{ id: string }>;
      rowId = inserted[0]?.id ?? "";
      c.inserted++;
    }

    // Record legacy → new-uuid mapping so later tables can resolve FKs.
    if (rowId && legacyToUuid[tableSqlName]) {
      legacyToUuid[tableSqlName]![legacyId] = rowId;
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseCli();
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (or DATABASE_URL_UNPOOLED) must be set.");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema, casing: "snake_case" });

  log(`Herbyte legacy import`);
  log(`=====================`);
  log(`Data dir: ${opts.dataDir}`);
  log(`Dry run:  ${opts.dryRun}`);
  if (opts.only) log(`Only:     ${[...opts.only].join(", ")}`);

  const order: Array<{
    file: string;
    label: string;
    fn: (rows: LegacyRow[]) => Promise<Counts>;
  }> = [
    {
      file: "User",
      label: "users",
      fn: (rows) => importUsers(db, rows, opts),
    },
    {
      file: "SellerProfile",
      label: "seller_profiles",
      fn: (rows) => upsertGeneric(db, "sellerProfiles", "seller_profiles", rows, opts),
    },
    {
      file: "Herb",
      label: "herbs",
      fn: (rows) => upsertGeneric(db, "herbs", "herbs", rows, opts),
    },
    {
      file: "Remedy",
      label: "remedies",
      fn: (rows) => upsertGeneric(db, "remedies", "remedies", rows, opts),
    },
    {
      file: "Product",
      label: "products",
      fn: (rows) => upsertGeneric(db, "products", "products", rows, opts),
    },
    {
      file: "Event",
      label: "events",
      fn: (rows) => upsertGeneric(db, "events", "events", rows, opts),
    },
    {
      file: "Comment",
      label: "comments",
      fn: (rows) => upsertGeneric(db, "comments", "comments", rows, opts),
    },
    {
      file: "RemedySubmission",
      label: "remedy_submissions",
      fn: (rows) => upsertGeneric(db, "remedySubmissions", "remedy_submissions", rows, opts),
    },
    {
      file: "HerbSubmission",
      label: "herb_submissions",
      fn: (rows) => upsertGeneric(db, "herbSubmissions", "herb_submissions", rows, opts),
    },
    {
      file: "Wishlist",
      label: "wishlists",
      fn: (rows) => upsertGeneric(db, "wishlists", "wishlists", rows, opts),
    },
  ];

  try {
    for (const step of order) {
      if (opts.only && !opts.only.has(step.file)) continue;
      const rows = await loadFile(opts.dataDir, step.file);
      if (rows === null) {
        log(`- ${step.label}: (no ${step.file}.json) skipped`);
        continue;
      }
      const counts = await step.fn(rows);
      log(
        `- ${step.label}: ${rows.length} in file → +${counts.inserted} inserted, ~${counts.updated} updated, x${counts.skipped} skipped`,
      );
    }
  } finally {
    await pool.end();
  }
  log(`\nDone.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
