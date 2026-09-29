# Herbyte

A community-built herbal-medicine reference: herbs, remedies, seller marketplace and events board, with AI-assisted safety review for community submissions.

Frontend: Vite + React SPA (react-router v7, Tailwind, shadcn/ui, TanStack Query).
Backend: Vercel Functions (Hono) + Neon Postgres (Drizzle) + Clerk + Groq + Vercel Blob + Resend + Serper/Tavily.

## Quick start

```bash
npm install
cp .env.example .env         # fill in the values described below
npm run db:generate          # writes SQL to drizzle/ (already checked in for the initial migration)
npm run db:migrate           # applies migrations to $DATABASE_URL_UNPOOLED
npm run dev                  # Vite on http://localhost:5173
vercel dev                   # (in another shell) runs the API on http://localhost:3000
```

For a first-time DB, run the legacy import to seed the herbs/remedies that shipped with the migration:

```bash
npm run import:data -- --dry-run
npm run import:data
```

## Environment

See `.env.example` for the canonical list. Required:

- **DATABASE_URL / DATABASE_URL_UNPOOLED** — Neon (pooled for the API, unpooled for migrations/imports).
- **CLERK_SECRET_KEY / VITE_CLERK_PUBLISHABLE_KEY** — Clerk.
- **GROQ_API_KEY** — required for AI endpoints; unset → they degrade to `ai_unavailable`.
- **SERPER_API_KEY** (and optionally **TAVILY_API_KEY**) — search grounding for submission moderation.
- **BLOB_READ_WRITE_TOKEN** — Vercel Blob for uploads.
- **RESEND_API_KEY** — contact form.
- **ADMIN_EMAILS** — comma-separated verified emails that become admins on first sign-in.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (5173) |
| `npm run build` | Static build to `dist/` |
| `npm run lint` | ESLint over JSX (TS files are checked by `tsc`) |
| `npm run test` | Vitest unit tests |
| `npm run db:generate` | Drizzle-kit — emit SQL from `server/schema.ts` |
| `npm run db:migrate` | Apply migrations from `drizzle/` |
| `npm run import:data` | Import `migration-data/*.json` (idempotent, `--dry-run`) |
| `npm run rehost:media` | Move legacy image URLs to Vercel Blob |
| `npm run probe:groq` | One-shot Groq probe (JSON mode + token measurements) |

## Layout

```
api/[...path].ts   Vercel Function entry — delegates to server/router.ts
server/            Env, DB, auth, policies, AI stack, routes
scripts/           tsx scripts: migrate, import, rehost, probe
drizzle/           Generated migrations
migration-data/    Legacy exports (gitignored)
src/               React SPA (unchanged design from the previous stack)
```

## Docs

See [`MIGRATION_REPORT.md`](MIGRATION_REPORT.md) for the full backend migration story (defect table, prompt design, cutover checklist).
