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
 * Does a plant with this name actually exist on Wikipedia?
 * Fastest hallucination check: if the AI confabulated a species
 * ("Urotheca obovata" is a snake, not a plant), it won't resolve
 * to a Wikipedia article whose Wikidata taxon identifies as a plant.
 *
 * Returns:
 *   {ok: true, taxonName?} — article found. taxonName when Wikidata has P225.
 *   {ok: false, reason} — not resolvable OR resolves to a non-plant.
 *
 * "Plant" check uses Wikidata's parent-taxon (P171) chain: if the
 * article has a Wikidata item with a P225 taxon name, it's considered
 * a plausible plant. Snakes, bacteria, etc. have articles with
 * different identifying claims (or no P225 at all in the fuzzy case).
 */
export async function verifyPlantName(name: string): Promise<
  { ok: true; taxonName: string | null; articleTitle: string }
  | { ok: false; reason: string }
> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty name" };

  const article = await fetchWikipediaLeadImage(trimmed);
  if (!article) {
    return { ok: false, reason: `no Wikipedia article found for "${trimmed}"` };
  }

  // If we got a verifiedBotanicalName (Wikidata P225 "taxon name"),
  // treat the article as a confirmed taxon — plants and animals both
  // use this, but combined with the next step we also check that it's
  // not obviously an animal.
  if (article.verifiedBotanicalName) {
    // Also verify the parent taxon is in the plant lineage. This is
    // the step that catches "Urotheca obovata" (a snake, genus
    // Urotheca) being confused with "Urera obovata" (a plant).
    const plantCheck = await isPlantTaxon(article.verifiedBotanicalName);
    if (plantCheck === false) {
      return {
        ok: false,
        reason: `"${trimmed}" resolves to ${article.verifiedBotanicalName} on Wikipedia, which is not a plant`,
      };
    }
    // plantCheck true OR null (couldn't determine) → accept
    return { ok: true, taxonName: article.verifiedBotanicalName, articleTitle: trimmed };
  }

  // No Wikidata taxon — the article exists but isn't a canonical
  // species page. Many plants have common-name articles without P225.
  // Accept but flag no verified taxon.
  return { ok: true, taxonName: null, articleTitle: trimmed };
}

/**
 * Query Wikidata for a taxon by its scientific name, then walk the
 * P171 "parent taxon" chain looking for Plantae (Q756). Returns true
 * when the chain includes Plantae, false when it doesn't (within a
 * shallow walk), null when we couldn't tell.
 */
async function isPlantTaxon(taxonName: string): Promise<boolean | null> {
  try {
    // Find the Wikidata entity whose P225 (taxon name) equals this
    // string. We use the search API on wikidata.org.
    const searchParams = new URLSearchParams({
      action: "wbsearchentities",
      format: "json",
      origin: "*",
      search: taxonName,
      language: "en",
      type: "item",
      limit: "5",
    });
    const search = await wikiFetch<{ search?: Array<{ id?: string; description?: string }> }>(
      `https://www.wikidata.org/w/api.php?${searchParams.toString()}`,
    );
    const candidates = search?.search ?? [];
    if (candidates.length === 0) return null;

    // Prefer a candidate described as a plant / species of plant / genus
    // of plants. If any candidate is described as a snake / fish /
    // mammal / insect, return false fast — the name is ambiguous and
    // the AI likely picked the wrong one.
    const descs = candidates
      .map((c) => (c.description ?? "").toLowerCase())
      .filter((d) => d.length > 0);
    const plantHit = descs.some((d) =>
      /plant|flora|herb|tree|shrub|grass|flower|vine|fern|moss|fungus/.test(d),
    );
    const animalHit = descs.some((d) =>
      /snake|lizard|fish|mammal|insect|spider|bird|reptile|amphibian|animal|species of [a-z]* (snake|lizard|bird|fish|insect|mammal)/.test(
        d,
      ),
    );
    if (plantHit && !animalHit) return true;
    if (animalHit && !plantHit) return false;

    // Ambiguous — walk the P171 chain of the first candidate.
    const topId = candidates[0]?.id;
    if (!topId) return null;
    return await walkParentTaxonForPlantae(topId);
  } catch {
    return null;
  }
}

async function walkParentTaxonForPlantae(
  entityId: string,
  maxDepth = 8,
): Promise<boolean | null> {
  // Q756 is Plantae on Wikidata. Q729 is Animalia.
  const PLANTAE = "Q756";
  const ANIMALIA = "Q729";
  let current: string | null = entityId;
  let depth = 0;
  const seen = new Set<string>();
  while (current && depth < maxDepth) {
    const here: string = current;
    if (seen.has(here)) return null;
    seen.add(here);

    const params: URLSearchParams = new URLSearchParams({
      action: "wbgetentities",
      format: "json",
      origin: "*",
      ids: here,
      props: "claims",
    });
    type TaxonEntities = {
      entities?: Record<
        string,
        { claims?: { P171?: Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }> } }
      >;
    };
    const data: TaxonEntities | null = await wikiFetch<TaxonEntities>(
      `https://www.wikidata.org/w/api.php?${params.toString()}`,
    );
    const parent: string | undefined =
      data?.entities?.[here]?.claims?.P171?.[0]?.mainsnak?.datavalue?.value?.id;
    if (!parent) return null;
    if (parent === PLANTAE) return true;
    if (parent === ANIMALIA) return false;
    current = parent;
    depth += 1;
  }
  return null;
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
