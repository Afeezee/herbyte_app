/**
 * Wikipedia / Wikimedia Commons image source.
 *
 * Herbal content on Unsplash is spotty — the tag model surfaces
 * lifestyle shots and brand collisions ("Kola nut" → Coca-Cola).
 * Wikipedia / Wikimedia Commons is specifically curated for
 * encyclopedic correctness: every botanical species has an article,
 * each with a lead image typically identified by botanists.
 *
 * No API key required, no rate anxiety at our volumes. Images are
 * CC-licensed (BY, BY-SA, or Public Domain) and permit commercial
 * use with attribution — the attribution string returned includes
 * credit + source link so the viewer page can display it.
 *
 * As a free bonus: when the article page carries a Wikidata entity
 * with a "taxon name" (P225) property, we return that as
 * verifiedBotanicalName — the caller can use it to cross-check the
 * AI's output (which sometimes pairs common/botanical names wrong).
 */

export type WikimediaImage = {
  url: string;              // direct image URL on upload.wikimedia.org
  attribution: string;      // human-readable "Image via Wikipedia (<title>)"
  source_url: string;       // Wikipedia article URL for click-through credit
  verifiedBotanicalName?: string | null; // Wikidata taxon name, when present
  source: "wikipedia" | "commons";
};

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "Herbyte/1.0 (herbyte.cereustechnologies.com; olagunjuafeez@gmail.com)";

async function wikiFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * OpenSearch fallback — fuzzy title lookup when direct-title + redirects
 * misses. Returns the top candidate title, or null. Used when e.g.
 * "African Pepper" has no exact Wikipedia title but the article
 * "Xylopia aethiopica" exists and matches that term.
 */
async function searchWikipediaTitle(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "opensearch",
    format: "json",
    origin: "*",
    search: query,
    limit: "3",
    namespace: "0",
  });
  const data = await wikiFetch<unknown>(`${WIKIPEDIA_API}?${params.toString()}`);
  // opensearch returns [query, [titles], [descriptions], [urls]]
  if (!Array.isArray(data)) return null;
  const titles = (data as unknown[])[1];
  if (!Array.isArray(titles) || titles.length === 0) return null;
  const first = titles[0];
  return typeof first === "string" && first.trim().length > 0 ? first : null;
}

/**
 * Fetch the lead image of a Wikipedia article by title. Follows
 * redirects (so "Zingiber officinale" lands on "Ginger"), and if the
 * direct title (even after redirects) has no match, falls back to
 * fuzzy opensearch — so "Bitter Leaf", "African Pepper" and other
 * common names without a canonical title still resolve.
 * Returns null only if no article matches at all.
 */
export async function fetchWikipediaLeadImage(title: string): Promise<WikimediaImage | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const direct = await fetchWikipediaLeadImageByExactTitle(trimmed);
  if (direct) return direct;

  // Fuzzy fallback — try the top opensearch candidate.
  const candidate = await searchWikipediaTitle(trimmed);
  if (candidate && candidate.toLowerCase() !== trimmed.toLowerCase()) {
    const fuzzy = await fetchWikipediaLeadImageByExactTitle(candidate);
    if (fuzzy) return fuzzy;
  }
  return null;
}

/**
 * Direct-title lookup (with redirect-follow). Separate so the fuzzy
 * fallback above can call it a second time without re-triggering
 * search recursion.
 */
async function fetchWikipediaLeadImageByExactTitle(title: string): Promise<WikimediaImage | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    redirects: "1",
    titles: trimmed,
    prop: "pageimages|pageprops|info",
    piprop: "original",
    pithumbsize: "1200",
    inprop: "url",
  });
  const data = await wikiFetch<{
    query?: {
      pages?: Record<string, {
        pageid?: number;
        title?: string;
        original?: { source?: string };
        thumbnail?: { source?: string };
        fullurl?: string;
        pageprops?: { wikibase_item?: string };
      }>;
    };
  }>(`${WIKIPEDIA_API}?${params.toString()}`);

  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages).find((p) => p.pageid && p.pageid > 0);
  if (!page) return null;

  const imageUrl = page.original?.source ?? page.thumbnail?.source;
  if (!imageUrl) return null;

  const pageTitle = page.title ?? trimmed;
  const pageUrl = page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/\s+/g, "_"))}`;

  // Optional: pull Wikidata taxon name if the page has an entity.
  let verifiedBotanicalName: string | null | undefined;
  const wikidataId = page.pageprops?.wikibase_item;
  if (wikidataId) {
    verifiedBotanicalName = await fetchWikidataTaxonName(wikidataId);
  }

  return {
    url: imageUrl,
    attribution: `Image via Wikipedia / Wikimedia Commons ("${pageTitle}")`,
    source_url: pageUrl,
    verifiedBotanicalName,
    source: "wikipedia",
  };
}

/**
 * Pull the Wikidata entity's "taxon name" (property P225). This is
 * the authoritative scientific name for the species, maintained by
 * botanists on Wikidata. Example: Q11148 (Ginger) → "Zingiber officinale".
 */
async function fetchWikidataTaxonName(entityId: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    origin: "*",
    ids: entityId,
    props: "claims",
    languages: "en",
  });
  const data = await wikiFetch<{
    entities?: Record<string, {
      claims?: {
        P225?: Array<{ mainsnak?: { datavalue?: { value?: string } } }>;
      };
    }>;
  }>(`https://www.wikidata.org/w/api.php?${params.toString()}`);

  const taxonName = data?.entities?.[entityId]?.claims?.P225?.[0]?.mainsnak?.datavalue?.value;
  if (typeof taxonName === "string" && taxonName.trim().length > 0) return taxonName.trim();
  return null;
}

/**
 * Search Wikimedia Commons for a photo of a species, keyed on
 * botanical name (unambiguous — "Cola nitida" never ambiguates with
 * soft drinks on Commons the way it does on Unsplash).
 * Picks the first high-quality result.
 */
export async function fetchCommonsImageByBotanical(botanical: string): Promise<WikimediaImage | null> {
  const trimmed = botanical.trim();
  if (!trimmed) return null;

  // Search Commons for files matching this botanical name.
  const searchParams = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    list: "search",
    srsearch: trimmed,
    srnamespace: "6", // File namespace
    srlimit: "5",
  });
  const search = await wikiFetch<{
    query?: { search?: Array<{ title?: string }> };
  }>(`${COMMONS_API}?${searchParams.toString()}`);

  const file = search?.query?.search?.find((s) => s.title && s.title.startsWith("File:"));
  if (!file || !file.title) return null;

  // Resolve to the actual image URL.
  const infoParams = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    titles: file.title,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
  });
  const info = await wikiFetch<{
    query?: {
      pages?: Record<string, {
        title?: string;
        imageinfo?: Array<{
          url?: string;
          thumburl?: string;
          descriptionurl?: string;
          extmetadata?: {
            Artist?: { value?: string };
            LicenseShortName?: { value?: string };
          };
        }>;
      }>;
    };
  }>(`${COMMONS_API}?${infoParams.toString()}`);

  const page = Object.values(info?.query?.pages ?? {})[0];
  const image = page?.imageinfo?.[0];
  const url = image?.thumburl ?? image?.url;
  if (!url) return null;

  // Strip HTML tags from Artist field (Commons returns rich HTML).
  const artistRaw = image?.extmetadata?.Artist?.value ?? "";
  const artist = artistRaw.replace(/<[^>]*>/g, "").trim() || "Unknown";
  const license = image?.extmetadata?.LicenseShortName?.value ?? "CC";

  return {
    url,
    attribution: `${artist} / Wikimedia Commons (${license})`,
    source_url: image?.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(file.title)}`,
    source: "commons",
  };
}

/**
 * Try Wikimedia sources in order: Wikipedia article by common name
 * (handles redirects, usually highest-quality lead image + optionally
 * the verified botanical name), then by botanical name, then
 * Commons search by botanical name. Returns null if nothing matched;
 * caller is expected to fall back to Unsplash.
 */
export async function fetchWikimediaImage(opts: {
  common_name?: string | null;
  botanical_name?: string | null;
}): Promise<WikimediaImage | null> {
  const common = opts.common_name?.trim() || null;
  const botanical = opts.botanical_name?.trim() || null;

  if (common) {
    const r = await fetchWikipediaLeadImage(common);
    if (r) return r;
  }
  if (botanical) {
    const r = await fetchWikipediaLeadImage(botanical);
    if (r) return r;
  }
  if (botanical) {
    const r = await fetchCommonsImageByBotanical(botanical);
    if (r) return r;
  }
  return null;
}
