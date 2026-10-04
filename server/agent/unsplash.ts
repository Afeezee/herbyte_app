/**
 * Thin Unsplash search client. The licence requires that we trigger
 * urls.download_location once per use AND attribute the photographer —
 * this module returns both so the caller can store attribution and
 * ping the download endpoint after the submission succeeds.
 */

/**
 * Build a cascade of Unsplash search queries in order of preference.
 * Short queries (2–3 words) match Unsplash's tag reality much better
 * than long specific ones — "Cola nitida botanical medicinal plant
 * leaves" returns zero results because nobody tags photos that way.
 *
 * Rules learned the hard way:
 *   - Common English names, not Latin binomials ("kola nut" not
 *     "Cola nitida"), because that's what people actually tag.
 *   - 2–3 words max, otherwise the AND-intersection returns zero.
 *   - One qualifier (plant / herb / leaves) to disambiguate from
 *     commercial products (soft drinks, snacks).
 *   - Never "tea" / "drink" / "cup" — those surface teacup photos.
 *
 * Returns an ORDERED list; the caller tries each until one returns
 * a result. Specific first, generic last so we land as close to the
 * right thing as Unsplash's library allows.
 */
export function buildHerbImageQueries(opts: {
  primary: string;
  botanical?: string | null;
  companions?: string[] | null;
}): string[] {
  const primary = (opts.primary ?? "").trim();
  const companions = (opts.companions ?? [])
    .map((c) => (c ?? "").trim())
    .filter((c) => c && c.toLowerCase() !== primary.toLowerCase());
  if (!primary) return [];

  const queries: string[] = [];
  // Most specific: primary + 1 companion + anchor.
  if (companions.length > 0) {
    queries.push(`${primary} ${companions[0]} herbs`);
  }
  // Primary herb with a plant/leaf qualifier — handles the "kola → soft
  // drink" case by nudging toward botanical imagery.
  queries.push(`${primary} plant`);
  queries.push(`${primary} leaves`);
  queries.push(`${primary} herb`);
  // Last resort: just the name, so we at least get SOMETHING rather
  // than nothing.
  queries.push(primary);
  // Dedupe while preserving order.
  return [...new Set(queries)];
}

export type UnsplashImage = {
  url: string; // urls.regular
  alt: string;
  attribution: string;
  photographer_name: string;
  photographer_url: string;
  photo_url: string;
  download_location: string;
};

const BASE = "https://api.unsplash.com";

function auth(key: string) {
  return { Authorization: `Client-ID ${key}` };
}

export async function searchUnsplash(
  key: string,
  query: string,
): Promise<UnsplashImage | null> {
  const url = new URL(`${BASE}/search/photos`);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "5");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");

  const res = await fetch(url.toString(), { headers: auth(key) });
  if (!res.ok) throw new Error(`Unsplash search failed: HTTP ${res.status}`);

  const data = (await res.json()) as {
    results?: Array<{
      alt_description?: string | null;
      description?: string | null;
      urls?: { regular?: string };
      links?: { html?: string; download_location?: string };
      user?: { name?: string; links?: { html?: string } };
    }>;
  };

  const picked = (data.results ?? []).find(
    (r) => r.urls?.regular && r.links?.download_location && r.user?.name,
  );
  if (!picked) return null;

  const photoUrl = picked.links?.html ?? "https://unsplash.com";
  const photographerName = picked.user?.name ?? "Unknown";
  const photographerUrl = picked.user?.links?.html ?? "https://unsplash.com";

  return {
    url: picked.urls!.regular!,
    alt: picked.alt_description || picked.description || query,
    attribution: `Photo by ${photographerName} on Unsplash (${photoUrl})`,
    photographer_name: photographerName,
    photographer_url: photographerUrl,
    photo_url: photoUrl,
    download_location: picked.links!.download_location!,
  };
}

/**
 * Try each query in order, return the first one that yields an image.
 * Stops as soon as something matches so we don't burn Unsplash
 * requests. Returns null if ALL queries came back empty — caller then
 * leaves image_url blank.
 */
export async function searchUnsplashCascade(
  key: string,
  queries: string[],
): Promise<{ image: UnsplashImage; matchedQuery: string } | null> {
  for (const q of queries) {
    if (!q || !q.trim()) continue;
    try {
      const img = await searchUnsplash(key, q);
      if (img) return { image: img, matchedQuery: q };
    } catch {
      // Any error on one query just moves to the next.
    }
  }
  return null;
}

/**
 * Per Unsplash licence: ping this URL every time we actually USE the
 * image. Doesn't download anything on our side — just a tracking hit
 * for the photographer's stats.
 */
export async function pingUnsplashDownload(
  key: string,
  downloadLocation: string,
): Promise<void> {
  try {
    await fetch(downloadLocation, { headers: auth(key) });
  } catch {
    // Attribution tracking is best-effort; don't fail the whole job.
  }
}
