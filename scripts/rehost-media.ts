/**
 * Rehost images from the legacy media host (LEGACY_MEDIA_HOST) to
 * Vercel Blob, then update the affected row's image_url / image_urls /
 * logo_url in place. Idempotent: rows already rehosted (URL not on the
 * legacy host) are skipped.
 *
 * Usage:
 *   npm run rehost:media -- --dry-run
 *   npm run rehost:media
 *   npm run rehost:media -- --entity=herbs
 *
 * Only runs on tables that have image columns. Because failures here are
 * per-row (network flakes, 404s on the legacy host), the script keeps
 * going on individual errors and reports a summary at the end.
 */
import "dotenv/config";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import * as schema from "../server/schema";
import { getEnv } from "../server/env";

type CliOpts = { dryRun: boolean; onlyEntity: string | null };

function parseCli(): CliOpts {
  const args = process.argv.slice(2);
  const opts: CliOpts = { dryRun: false, onlyEntity: null };
  for (const a of args) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a.startsWith("--entity=")) opts.onlyEntity = a.slice("--entity=".length);
  }
  return opts;
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function isLegacy(url: string | null | undefined, host: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === host;
  } catch {
    return false;
  }
}

async function downloadAndUpload(
  sourceUrl: string,
  token: string,
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${sourceUrl}`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const ext =
    contentType.includes("jpeg") ? "jpg" :
    contentType.includes("png") ? "png" :
    contentType.includes("webp") ? "webp" :
    contentType.includes("gif") ? "gif" :
    "bin";
  const buffer = await res.arrayBuffer();
  const path = `rehost/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const blob = await put(path, buffer, {
    access: "public",
    contentType,
    token,
    addRandomSuffix: false,
  });
  return blob.url;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

async function rehostSingle(
  db: Db,
  legacyHost: string,
  blobToken: string,
  opts: CliOpts,
  {
    label,
    table,
    column,
  }: {
    label: string;
    table:
      | typeof schema.herbs
      | typeof schema.remedies
      | typeof schema.events
      | typeof schema.sellerProfiles;
    column: "image_url" | "logo_url";
  },
): Promise<{ scanned: number; rehosted: number; skipped: number; errors: number }> {
  const rows = (await db.select().from(table as never)) as unknown as Array<
    Record<string, unknown> & { id: string }
  >;
  let rehosted = 0;
  let skipped = 0;
  let errors = 0;
  const idCol = (table as unknown as { id: unknown }).id;
  for (const row of rows) {
    const url = row[column] as string | null;
    if (!isLegacy(url, legacyHost)) {
      skipped++;
      continue;
    }
    try {
      if (opts.dryRun) {
        log(`  [dry] ${label} ${row.id}: would rehost ${url}`);
        rehosted++;
        continue;
      }
      const newUrl = await downloadAndUpload(url!, blobToken);
      await db
        .update(table as never)
        .set({ [column]: newUrl } as never)
        .where(eq(idCol as never, row.id as never));
      rehosted++;
      log(`  ${label} ${row.id}: ${url} → ${newUrl}`);
    } catch (err) {
      errors++;
      log(`  ! ${label} ${row.id}: ${(err as Error).message}`);
    }
  }
  return { scanned: rows.length, rehosted, skipped, errors };
}

async function rehostArrayColumn(
  db: Db,
  legacyHost: string,
  blobToken: string,
  opts: CliOpts,
  {
    label,
    table,
    column,
  }: {
    label: string;
    table: typeof schema.products;
    column: "image_urls";
  },
): Promise<{ scanned: number; rehosted: number; skipped: number; errors: number }> {
  const rows = (await db.select().from(table as never)) as unknown as Array<{
    id: string;
    image_urls: string[];
  }>;
  let rehosted = 0;
  let skipped = 0;
  let errors = 0;
  const idCol = (table as unknown as { id: unknown }).id;
  for (const row of rows) {
    const urls = row[column] ?? [];
    const legacyIdx = urls
      .map((u: string, i: number) => ({ u, i }))
      .filter(({ u }: { u: string }) => isLegacy(u, legacyHost));
    if (legacyIdx.length === 0) {
      skipped++;
      continue;
    }
    const updated = [...urls];
    try {
      for (const { u, i } of legacyIdx) {
        if (opts.dryRun) {
          log(`  [dry] ${label} ${row.id}[${i}]: would rehost ${u}`);
          continue;
        }
        updated[i] = await downloadAndUpload(u, blobToken);
      }
      if (!opts.dryRun) {
        await db
          .update(table as never)
          .set({ [column]: updated } as never)
          .where(eq(idCol as never, row.id as never));
      }
      rehosted++;
    } catch (err) {
      errors++;
      log(`  ! ${label} ${row.id}: ${(err as Error).message}`);
    }
  }
  return { scanned: rows.length, rehosted, skipped, errors };
}

async function main() {
  const opts = parseCli();
  const env = getEnv();
  if (!env.BLOB_READ_WRITE_TOKEN && !opts.dryRun) {
    throw new Error("BLOB_READ_WRITE_TOKEN must be set (or run --dry-run).");
  }
  const url = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema, casing: "snake_case" });

  log(`Rehost media`);
  log(`============`);
  log(`Legacy host: ${env.LEGACY_MEDIA_HOST}`);
  log(`Dry run:     ${opts.dryRun}`);

  const jobs = [
    {
      key: "herbs",
      run: () =>
        rehostSingle(db, env.LEGACY_MEDIA_HOST, env.BLOB_READ_WRITE_TOKEN ?? "", opts, {
          label: "herb",
          table: schema.herbs,
          column: "image_url",
        }),
    },
    {
      key: "remedies",
      run: () =>
        rehostSingle(db, env.LEGACY_MEDIA_HOST, env.BLOB_READ_WRITE_TOKEN ?? "", opts, {
          label: "remedy",
          table: schema.remedies,
          column: "image_url",
        }),
    },
    {
      key: "events",
      run: () =>
        rehostSingle(db, env.LEGACY_MEDIA_HOST, env.BLOB_READ_WRITE_TOKEN ?? "", opts, {
          label: "event",
          table: schema.events,
          column: "image_url",
        }),
    },
    {
      key: "seller_profiles",
      run: () =>
        rehostSingle(db, env.LEGACY_MEDIA_HOST, env.BLOB_READ_WRITE_TOKEN ?? "", opts, {
          label: "seller",
          table: schema.sellerProfiles,
          column: "logo_url",
        }),
    },
    {
      key: "products",
      run: () =>
        rehostArrayColumn(db, env.LEGACY_MEDIA_HOST, env.BLOB_READ_WRITE_TOKEN ?? "", opts, {
          label: "product",
          table: schema.products,
          column: "image_urls",
        }),
    },
  ];

  try {
    for (const job of jobs) {
      if (opts.onlyEntity && opts.onlyEntity !== job.key) continue;
      log(`\n${job.key}:`);
      const r = await job.run();
      log(
        `  ${job.key} → scanned ${r.scanned}, rehosted ${r.rehosted}, skipped ${r.skipped}, errors ${r.errors}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
