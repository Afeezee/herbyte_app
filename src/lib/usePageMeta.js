import { useEffect } from 'react'

const SITE_NAME = 'Herbyte'
const DEFAULT_DESCRIPTION =
  'A community-built herbal-medicine reference: herbs, remedies, seller marketplace and workshops — with evidence ratings and drug-interaction checks.'
const DEFAULT_OG_IMAGE = 'https://herbyte.cereustechnologies.com/og.svg'

/**
 * Set the browser tab title, meta description and Open Graph tags for
 * the current page. Restores the previous values on unmount so
 * navigating between pages doesn't leak stale metadata.
 *
 * NOTE: this only affects the LIVE tab. Crawlers (Facebook, Twitter,
 * WhatsApp, LinkedIn) don't execute JavaScript, so they see whatever
 * is in index.html at fetch time. For truly dynamic per-page OGs on
 * shared links, you'd need SSR or an Edge middleware that injects
 * OG tags into HTML for known crawler user-agents. See MIGRATION_REPORT
 * "Known debt" for that path.
 *
 * Usage:
 *   usePageMeta({ title: 'Explore Herbs' })
 *   usePageMeta({
 *     title: herb.common_name,
 *     description: herb.description,
 *     image: herb.image_url,
 *   })
 */
export function usePageMeta({ title, description, image } = {}) {
  useEffect(() => {
    const prev = {
      title: document.title,
      description: getMeta('name', 'description'),
      ogTitle: getMeta('property', 'og:title'),
      ogDescription: getMeta('property', 'og:description'),
      ogImage: getMeta('property', 'og:image'),
      twitterTitle: getMeta('name', 'twitter:title'),
      twitterDescription: getMeta('name', 'twitter:description'),
      twitterImage: getMeta('name', 'twitter:image'),
    }

    const nextTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME
    document.title = nextTitle

    const desc = description ?? DEFAULT_DESCRIPTION
    const img = image ?? DEFAULT_OG_IMAGE

    setMeta('name', 'description', desc)
    setMeta('property', 'og:title', nextTitle)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:image', img)
    setMeta('name', 'twitter:title', nextTitle)
    setMeta('name', 'twitter:description', desc)
    setMeta('name', 'twitter:image', img)

    return () => {
      document.title = prev.title
      if (prev.description !== null) setMeta('name', 'description', prev.description)
      if (prev.ogTitle !== null) setMeta('property', 'og:title', prev.ogTitle)
      if (prev.ogDescription !== null) setMeta('property', 'og:description', prev.ogDescription)
      if (prev.ogImage !== null) setMeta('property', 'og:image', prev.ogImage)
      if (prev.twitterTitle !== null) setMeta('name', 'twitter:title', prev.twitterTitle)
      if (prev.twitterDescription !== null)
        setMeta('name', 'twitter:description', prev.twitterDescription)
      if (prev.twitterImage !== null) setMeta('name', 'twitter:image', prev.twitterImage)
    }
  }, [title, description, image])
}

function getMeta(attr, key) {
  const el = document.head.querySelector(`meta[${attr}="${key}"]`)
  return el ? el.getAttribute('content') : null
}

function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}
