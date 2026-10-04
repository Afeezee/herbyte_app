/**
 * Thin Unsplash search client. The licence requires that we trigger
 * urls.download_location once per use AND attribute the photographer —
 * this module returns both so the caller can store attribution and
 * ping the download endpoint after the submission succeeds.
 */

/**
 * Build an Unsplash search query anchored on BOTANICAL / PLANT imagery.
 * Query construction matters a lot — common names like "kola" return
 * soft-drink photos; "chamomile tea" returns teacup photos. We fix
 * both by:
 *   - prefixing the Latin botanical name when we have one (unambiguous),
 *   - never including "tea" / "drink" / "cup" — they attract prepared-
 *     drink imagery instead of the raw herb,
 *   - adding "botanical medicinal plant leaves" as a trailing anchor,
 *   - for remedies, including up to 2 companion herbs so composite
 *     shots like "ginger cinnamon" surface naturally.
 */
export function buildHerbImageQuery(opts: {
  primary: string;
  botanical?: string | null;
  companions?: string[] | null;
}): string {
  const anchor = "botanical medicinal plant leaves";
  const herbs: string[] = [];
  const primary = (opts.primary ?? "").trim();
  if (primary) herbs.push(primary);
  for (const c of (opts.companions ?? []).slice(0, 2)) {
    const name = (c ?? "").trim();
    if (!name) continue;
    if (name.toLowerCase() === primary.toLowerCase()) continue;
    herbs.push(name);
  }
  const botanical = (opts.botanical ?? "").trim();
  // Latin binomial first — most unambiguous. "Cola nitida botanical"
  // never surfaces a soft-drink; "Cola botanical" alone can.
  const parts = [botanical, herbs.join(" "), anchor].filter(Boolean);
  return parts.join(" ");
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
