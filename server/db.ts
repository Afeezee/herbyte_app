import { neon } from "@neondatabase/serverless";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import { getEnv } from "./env";
import * as schema from "./schema";

// -----------------------------------------------------------------------------
// Two Drizzle drivers coexist here, on purpose:
//
// - neon-http: stateless HTTP, fast for one-shot reads/writes in a serverless
//   function. NO interactive transactions.
// - neon-serverless (Pool): supports transactions; used only for multi-table
//   writes (e.g. publishing a submission → creating a Herb/Remedy while
//   flipping the submission row).
//
// The Vercel Function is short-lived; each invocation creates its own client.
// -----------------------------------------------------------------------------

let cachedHttp: ReturnType<typeof drizzleHttp<typeof schema>> | null = null;

export function getDb() {
  if (cachedHttp) return cachedHttp;
  const env = getEnv();
  const sql = neon(env.DATABASE_URL);
  cachedHttp = drizzleHttp(sql, { schema, casing: "snake_case" });
  return cachedHttp;
}

/**
 * Returns a Drizzle client with transaction support. The caller is
 * responsible for ending the pool once done (see `withTransaction`).
 */
export async function withTransaction<T>(
  fn: (tx: ReturnType<typeof drizzleServerless<typeof schema>>) => Promise<T>,
): Promise<T> {
  const env = getEnv();
  const url = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });
  const db = drizzleServerless(pool, { schema, casing: "snake_case" });
  try {
    return await db.transaction(async (tx) => fn(tx as never));
  } finally {
    await pool.end().catch(() => {});
  }
}

export { schema };
