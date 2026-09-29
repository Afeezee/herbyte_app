/**
 * Vercel Edge Middleware — dynamic Open Graph tags for shared profile
 * links.
 *
 * Social-media crawlers (facebookexternalhit, Twitterbot, WhatsApp,
 * LinkedInBot, Slackbot, Discordbot, Applebot, Telegrambot, and so on)
 * don't execute JavaScript, so `usePageMeta` in the browser never
 * reaches them — they see the generic tags baked into index.html at
 * build time.
 *
 * This middleware intercepts only the profile paths for known crawlers,
 * fetches the item straight from Neon over HTTP, and rewrites the
 * relevant meta tags in the served HTML. Non-crawler traffic (real
 * users) passes through unchanged and gets the SPA as before.
 *
 * Edge runtime — no Node built-ins used. @neondatabase/serverless's
 * `neon()` HTTP driver is Edge-compatible.
 */
import { neon } from "@neondatabase/serverless";

export const config = {
  matcher: [
    "/herbprofile",
    "/remedyprofile",
    "/productprofile",
    "/eventprofile",
  ],
};

// User-agents that fetch pages purely for link-preview extraction. Order
// doesn't matter; the regex is case-insensitive.
const CRAWLER_UA =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|Discordbot|TelegramBot|Applebot|Pinterest|SkypeUriPreview|Snapchat|Google-InspectionTool|Mastodon|redditbot|iframely|Embedly|bingbot|Baiduspider|YandexBot/i;

const SITE = "https://herbyte.cereustechnologies.com";
const DEFAULT_IMAGE = `${SITE}/og.png`;

type ProfileConfig = {
  table: string;
  titleCol: string;
  imageExpr: string;
};

const PROFILES: Record<string, ProfileConfig> = {
  "/herbprofile": {
    table: "herbs",
    titleCol: "common_name",
    imageExpr: "image_url",
  },
  "/remedyprofile": {
    table: "remedies",
    titleCol: "name",
    imageExpr: "image_url",
  },
  "/productprofile": {
    table: "products",
    titleCol: "product_name",
    // Products carry an array of image URLs; use the first.
    imageExpr: "image_urls[1]",
  },
  "/eventprofile": {
    table: "events",
    titleCol: "title",
    imageExpr: "image_url",
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function isAbsoluteUrl(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

/**
 * Replace the `content="..."` of a meta tag identified by `attr="key"`.
 * Uses a lazy regex so only the first occurrence of each tag changes.
 */
function replaceMetaContent(
  html: string,
  attr: string,
  key: string,
  value: string,
): string {
  const re = new RegExp(
    `(<meta\\s+${attr}="${escapeRegex(key)}"\\s+content=")[^"]*(")`,
    "i",
  );
  return html.replace(re, `$1${value}$2`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function middleware(
  request: Request,
): Promise<Response | undefined> {
  // Users get the SPA untouched.
  const ua = request.headers.get("user-agent") ?? "";
  if (!CRAWLER_UA.test(ua)) return;

  const url = new URL(request.url);
  const profile = PROFILES[url.pathname];
  if (!profile) return;

  const id = url.searchParams.get("id");
  if (!id || !UUID_RE.test(id)) return;

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return;

    const sql = neon(dbUrl);
    // Table + column identifiers come from a fixed map (no user input),
    // so string interpolation is safe. The id is parameterised.
    const query =
      `SELECT ${profile.titleCol} AS title, description, ${profile.imageExpr} AS image ` +
      `FROM ${profile.table} WHERE id = $1 LIMIT 1`;
    const rows = (await sql(query, [id])) as Array<{
      title: string | null;
      description: string | null;
      image: string | null;
    }>;
    const row = rows[0];
    if (!row) return;

    // Fetch the base HTML (same-origin) and rewrite the relevant tags.
    const htmlUrl = `${url.origin}/`;
    const htmlRes = await fetch(htmlUrl, {
      headers: { "x-og-middleware": "1" }, // avoid recursion, though matcher already prevents /
    });
    if (!htmlRes.ok) return;
    let html = await htmlRes.text();

    const title = escapeHtml((row.title ?? "Herbyte").slice(0, 200));
    const description = escapeHtml(
      (row.description ?? "").replace(/\s+/g, " ").slice(0, 300),
    );
    const image = isAbsoluteUrl(row.image) ? escapeHtml(row.image) : DEFAULT_IMAGE;
    const pageTitle = `${title} · Herbyte`;
    const canonical = escapeHtml(url.toString());

    // <title>
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${pageTitle}</title>`);

    // Standard meta
    html = replaceMetaContent(html, "name", "description", description);

    // Open Graph
    html = replaceMetaContent(html, "property", "og:title", pageTitle);
    html = replaceMetaContent(html, "property", "og:description", description);
    html = replaceMetaContent(html, "property", "og:url", canonical);
    html = replaceMetaContent(html, "property", "og:image", image);
    html = replaceMetaContent(html, "property", "og:image:secure_url", image);
    html = replaceMetaContent(html, "property", "og:image:alt", title);

    // Twitter
    html = replaceMetaContent(html, "name", "twitter:title", pageTitle);
    html = replaceMetaContent(html, "name", "twitter:description", description);
    html = replaceMetaContent(html, "name", "twitter:url", canonical);
    html = replaceMetaContent(html, "name", "twitter:image", image);
    html = replaceMetaContent(html, "name", "twitter:image:alt", title);

    // The image:type/width/height baked into index.html describe the
    // static PNG. If we're serving a legacy JPG/WebP from Vercel Blob
    // or elsewhere, drop those hints so the platform inspects the
    // actual image.
    if (image !== DEFAULT_IMAGE) {
      html = html
        .replace(/<meta property="og:image:type" content="[^"]*"\s*\/?>/i, "")
        .replace(/<meta property="og:image:width" content="[^"]*"\s*\/?>/i, "")
        .replace(/<meta property="og:image:height" content="[^"]*"\s*\/?>/i, "");
    }

    // Update canonical link too.
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${canonical}" />`,
    );

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Cache the crawler-rendered HTML on Vercel's edge for 5 min so
        // repeat pulls from the same bot don't re-hit Neon.
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "x-og-source": "edge-middleware",
      },
    });
  } catch (err) {
    // Never fail the request over an OG rewrite — fall through to SPA.
    console.error("[og-middleware]", err);
    return;
  }
}
