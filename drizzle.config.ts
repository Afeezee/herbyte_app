import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL (or DATABASE_URL_UNPOOLED) must be set to run drizzle-kit.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
