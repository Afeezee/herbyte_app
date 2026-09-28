/**
 * Applies pending Drizzle migrations from ./drizzle to the database in
 * DATABASE_URL_UNPOOLED (falls back to DATABASE_URL). Run with `npm run
 * db:migrate` after `npm run db:generate`.
 */
import "dotenv/config";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set.");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log("Applying migrations from ./drizzle …");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Done.");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
