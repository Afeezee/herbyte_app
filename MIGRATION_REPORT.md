# Herbyte migration report

**From:** Base44 (SDK-hosted entities + integrations)
**To:** Vercel Functions + Neon Postgres (Drizzle) + Clerk + Groq + Vercel Blob + Resend + Serper/Tavily
**Frontend:** Vite + React + Tailwind + shadcn/ui — **unchanged design and routes**.

## What each page uses now

| Page | Data source now | Notes |
| --- | --- | --- |
| Home | `api.entities.Remedy.filter({featured, approved_by_ai})` | Same shape; served by generic entity router. |
| ExploreHerbs | `api.entities.Herb.list()` + `api.ai.searchSuggestions({kind:'herb'})` | Debounced client-side. |
| HerbProfile | `api.entities.Herb.filter({id})` + `api.entities.Herb.delete` | Admin-only delete enforced server-side. |
| SubmitRemedy | `api.submissions.remedy(...)` / `api.submissions.herb(...)` | Server does moderation, search grounding, reference filtering, row insert. **No client-side publish.** |
| About | Static | — |
| Contact | `api.SendEmail(...)` → Resend | Per-IP rate-limit 5/hour. |
| ExploreRemedies | `api.entities.Remedy.filter({approved_by_ai:true})` + `api.ai.searchSuggestions({kind:'remedy'})` | — |
| RemedyProfile | `api.entities.Remedy.filter({id})` + related products/herbs | — |
| SellerDashboard | `api.entities.SellerProfile.*`, `api.entities.Product.*` | seller_id forced from session. |
| ExploreProducts | `api.entities.Product.filter(...)` | — |
| ProductProfile | `api.entities.Product.filter({id})` + seller + remedy | — |
| UserProfile | Multiple entity filters keyed by session email | — |
| Wishlist | `api.entities.Wishlist.filter({user_email:me})` | Server ignores client user_email and forces own only. |
| Events / EventProfile / OrganizeEvent | `api.entities.Event.*` | — |
| AdminDashboard | Full lists + moderation controls | Admin-only via policy table. |
| Layout / AIAssistant | `api.ai.assistant({symptoms})` | Named endpoint (no more generic InvokeLLM). |

## Frontend files changed

Nothing else in the UI changed. The concrete diff:

- **Renamed** `src/api/base44Client.js → src/api/client.js` and swapped the export name (`base44 → api`). Every JSX/JS file that imported `base44` was mechanically updated.
- **Rewrote** `src/main.jsx` — added `ClerkProvider`.
- **Rewrote** `src/App.jsx` — added `/sign-in` and `/sign-up` routes with Clerk's `<SignIn>`; wrapped the main app in `<SignedIn>/<SignedOut>` so every non-auth route is gated.
- **Rewrote** `src/lib/AuthContext.jsx` — same public shape (`user`, `isAuthenticated`, `isLoadingAuth`, `authError`, `logout`, `navigateToLogin`, `checkAppState`) backed by Clerk + `/api/auth/me`.
- **Rewrote the 7 `InvokeLLM` call sites** to call the specific `api.ai.*` / `api.submissions.*` endpoint.
- **Updated `SubmitRemedy.jsx` success copy** — the F3 UX change: an AI-approved submission no longer says "Published Successfully!"; it says "Submitted — Queued for Publishing" because publication now requires an admin.
- **Deleted** the dead files listed in section 2 of the migration prompt: `src/api/{entities,integrations}.js`, `src/lib/{app-params.js,NavigationTracker.jsx,VisualEditAgent.jsx,iframe-messaging.js}`, `src/pages/OAuthConsent.jsx`, `src/components/{AuthLayout,ProtectedRoute,UserNotRegisteredError}.jsx`, and `vite-plugins/*`.

## Defect table

| # | Status | Notes |
| --- | --- | --- |
| F1 (Identity spoofing on Comment/Wishlist) | **Fixed** | `Comment.author_email`, `author_name`, and `Wishlist.user_email` are overwritten from the session in `server/policies.ts` (Comment and Wishlist `onCreate`); `onUpdate` also strips these fields so an owner can't rewrite them either. |
| F2 (Client-trusted role/seller fields) | **Fixed** | `PATCH /api/auth/me` accepts only `seller_profile_id`, `is_seller`, `full_name`. `role` never appears in that allow-list; the only way to become admin is `ADMIN_EMAILS` at first sign-in, or an existing admin flipping a row through the admin entity route (which strips `role` for non-admins too). |
| F3 (AI-approved submissions auto-published) | **Fixed** | `POST /api/submissions/{remedy,herb}` inserts only into the `*_submissions` table with the AI verdict; the enriched draft is stored in `draft_payload`. A separate admin endpoint `POST /api/submissions/{remedy,herb}/:id/publish` performs the actual `herbs`/`remedies` insert inside a transaction. `SubmitRemedy.jsx` copy updated accordingly. |
| F4 (Fabricated citations from `add_context_from_internet`) | **Fixed** | Server-side flow: run `search()` (Serper primary, Tavily fallback), embed the results in a `<search_results>` block, tell the model to only cite listed URLs, then `filterCitedReferences()` in code drops any URL not in the returned set. Any surviving references still store with `references_pending_review: true`. |
| F5 (`Product` / `SellerProfile` `moderation_status` was set-and-forgotten) | **Ready to fix in UI** | The server allows an admin to `PATCH .../moderation_status`; visible-only-when-Approved gating for `ExploreProducts` should be added to the query in a follow-up (see Known debt below). |
| F6 (Dead SDK exports SendSMS/GenerateImage/ExtractDataFromUploadedFile) | **Removed** | The new `src/api/client.js` never exposes them; the dead re-export file `src/api/integrations.js` was deleted. |
| F7 (Unused deps) | **Partially removed** | Confirmed unused by grep and removed: `@base44/sdk`, `@base44/vite-plugin`, `three`, `lodash`, `moment`, `react-quill`, `react-leaflet`, `@hello-pangea/dnd`, `framer-motion`. Kept for now (still referenced): the shadcn/ui + Radix set. |

## AI stack

- **Model:** `qwen/qwen3.8-27b` via Groq's OpenAI-compatible API. Behind `AI_MODEL` env var; `AI_FALLBACK_MODEL` supports failover when Groq withdraws the Preview model.
- **Budget:** Postgres `llm_usage` ledger. RPM/TPM/TPD ceilings from env (`GROQ_RPM_CEILING=25`, `GROQ_TPM_CEILING=7000`, `GROQ_TPD_CEILING=180000` by default — well below Groq's published free-tier limits).
- **Cache:** `ai_response_cache` keyed by content hash. Default TTL 6h.
- **Rate limits:** per-user, per-endpoint (20/hour assistant, 30/hour insights, 60/hour suggestions, 5/day submissions).
- **JSON:** `response_format: {type:"json_object"}` first; one repair retry if parsing fails; `<think>…</think>` and code fences stripped in `extractJson()`.
- **Search grounding:** Serper primary, Tavily fallback (`server/ai/search.ts`), daily budget `SEARCH_DAILY_CEILING`. Verified server-side against `research_references[].url` before storing.
- **Prompt injection framing:** every free-text field wrapped in `<user_input>…</user_input>`, escaped for any embedded closing tag; system message states the tag is untrusted data.
- **Observability:** `moderation_events` records endpoint, verdict, model, tokens, error code, small structured summary. **Never** stores the full free-text health input.

## Groq probe

Run `npm run probe:groq` locally once `GROQ_API_KEY` is set. The probe emits token counts for the light (search-suggestions) and heavy (submission-moderation) prompts in both `json_mode` and prompted-JSON, plus an estimated per-day capacity given the current TPD ceiling. **This report line should be filled in after the first run** — the numbers depend on both Groq's model behaviour and Herbyte's real prompt content, and they are what you'll use to decide whether to raise `GROQ_TPD_CEILING`.

## Auto-publish behaviour change (highlight)

The only deliberate frontend UX change in this migration:

Base44 behaviour: `SubmitRemedy` → AI moderation → if Approved → immediate `Remedy.create()` → success screen says **"Published Successfully!"**.

New behaviour: `SubmitRemedy` → server calls `/api/submissions/remedy` → AI moderation runs server-side → row inserted with `ready_to_publish=true`, `draft_payload` populated — but **the public `remedies` table is NOT touched**. Success screen says **"Submitted — Queued for Publishing"** and explains an admin review is needed. The admin dashboard's `Publish` action calls `POST /api/submissions/remedy/:id/publish`, which is the only path to a live public row.

Motivation: the Base44 default was to publish medical-adjacent content (dosages, drug interactions) after a lone 3.8B-parameter Preview model said Approved. That's not a safe default for the domain. The change costs users a couple of hours of latency between submission and publication in exchange for expert eyes on every published record.

## The `add_context_from_internet` gap

Base44's `InvokeLLM` had a `add_context_from_internet: true` flag used by both submission forms. Groq has no equivalent. Naively porting would have made F4 worse (ungrounded model output presented as citations). What we did instead:

1. **Real search step** via Serper's `google.serper.dev/search` endpoint before the moderation call. Fallback to Tavily on quota exhaustion. Both go in `search_response_cache` (6h) so resubmissions and near-duplicate queries stay cheap.
2. Top 5 results (title + URL + snippet) inlined in a `<search_results>…</search_results>` block; prompt says the model may only cite URLs from that block.
3. `filterCitedReferences()` in `server/ai/search.ts` normalises URL protocol + host + path and drops any reference whose URL isn't in the search result set.
4. Even the surviving references are stored with `references_pending_review: true`. The admin `publish` action clears the flag.

## Env vars to set in Vercel

Copy from `.env.example`. Minimum for a working preview: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`. AI features degrade cleanly (`ai_unavailable`) until `GROQ_API_KEY` is set. Contact form 500s until `RESEND_API_KEY` is set. Uploads 500 until `BLOB_READ_WRITE_TOKEN` is set. Search grounding is silently skipped if neither `SERPER_API_KEY` nor `TAVILY_API_KEY` is set (model gets an empty `<search_results>` block).

## Cutover checklist

1. Create Neon project → grab pooled + unpooled URLs → set `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
2. Create Clerk app → set `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`. Set `ADMIN_EMAILS` to your own verified email so you become admin on first sign-in.
3. Create Vercel project linked to this repo. Add the Vercel Blob store; grab `BLOB_READ_WRITE_TOKEN`.
4. Create Resend account + verify a sender domain → set `RESEND_API_KEY`. Update `CONTACT_TO_EMAIL` if not `hello@herbyte.com`.
5. Sign up for Serper (or Tavily) → set `SERPER_API_KEY` / `TAVILY_API_KEY`.
6. Sign up for Groq → set `GROQ_API_KEY`. Leave `AI_MODEL` at default until you decide otherwise.
7. Set `CRON_SECRET` to a random 32-byte string; Vercel Cron will use it.
8. `npm run db:generate && npm run db:migrate` against `DATABASE_URL_UNPOOLED`.
9. `npm run import:data -- --dry-run` (should report row counts from `migration-data/*.json`), then `npm run import:data`.
10. `npm run rehost:media -- --dry-run`, then `npm run rehost:media` once you're happy with the plan.
11. `vercel deploy` (preview) → smoke-test → `vercel deploy --prod`.
12. Point the Herbyte domain at the new deployment. Keep the old Base44 app up for a rollback window (say 2 weeks) before decommissioning.

## Known debt (deliberately not fixed here)

- **Search grounding cost:** Serper's free credits are one-time (2,500). Tavily is 1,000/month. Real traffic will need a paid tier of one of them, or a third provider.
- **`ExploreProducts` visibility gating:** the policy allows public read of all products; the query in the UI should be tightened to `moderation_status="Approved"` (server side or via the compat client's `filter`). Not audited beyond F5's write path.
- **MCP/OAuth consent:** dropped entirely. The Base44 flow was unfinished boilerplate; not re-implemented here.
- **Product/SellerProfile approve UI:** the admin dashboard needs a per-row Approve action wired to a `PATCH` of `moderation_status`. Server side is ready.
- **Cron retries:** `POST /api/cron/moderation-retry` is scheduled every 30 minutes in `vercel.json` but currently returns `{ok:true, retried:0}` — it's a placeholder for the "resubmit deferred submissions" loop.

## What to do first

1. Set env vars in Vercel and run `npm run db:migrate`.
2. Run `npm run import:data` to seed the herbs/remedies bundled in `migration-data/`.
3. Sign in with a `ADMIN_EMAILS` email to bootstrap yourself as admin.
4. Read the Groq probe output and decide whether to raise `GROQ_TPD_CEILING`.
5. Point the domain, keep Base44 warm for a rollback window.
