// lib/storefront/seo.ts
//
// Canonical URLs and schema.org payloads for the storefront. Pure: no React, no
// I/O, no `next/*` imports — pages call it from `generateMetadata` and from the
// `<script type="application/ld+json">` islands alike.

import type {
  CollectionSummary,
  ProductCardData,
  ProductDetail,
  ProductVariant,
} from '@/lib/shopify/types'
import { selectedOptionsToParams } from '@/lib/storefront/variants'

/** Fallback origin when `NEXT_PUBLIC_BASE_URL` is not set (production domain). */
export const DEFAULT_SITE_URL = 'https://headoverfeels.com'

/** The brand as it should appear in structured data. */
export const BRAND_NAME = 'Head Over Feels'

/**
 * Absolute URL for `path`, with exactly one slash between origin and path and
 * no trailing slash on the origin itself.
 */
export function siteUrl(path?: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_SITE_URL).trim().replace(/\/+$/, '')
  if (!path) return base
  return `${base}/${path.replace(/^\/+/, '')}`
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

/**
 * Shopify `descriptionHtml` -> plain text for meta descriptions and JSON-LD.
 * Tags go first, then entities, so a `&lt;script&gt;` in the copy stays text.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Clip to `n` characters (ellipsis included), preferring the last word break. */
export function truncate(value: string, n: number): string {
  if (value.length <= n) return value
  const clipped = value.slice(0, Math.max(0, n - 1)).trimEnd()
  const lastSpace = clipped.lastIndexOf(' ')
  const body = lastSpace > n / 2 ? clipped.slice(0, lastSpace) : clipped
  return `${body.trimEnd()}…`
}

/** Canonical PDP URL, with the variant's options as query params when known. */
function productUrl(product: ProductDetail, selected: ProductVariant | null): string {
  const canonical = siteUrl(`/products/${product.handle}`)
  if (!selected) return canonical

  const options: Record<string, string> = {}
  for (const option of selected.selectedOptions) options[option.name] = option.value
  const query = selectedOptionsToParams(options).toString()

  return query.length > 0 ? `${canonical}?${query}` : canonical
}

/** schema.org `Product` with a single `Offer` for the selected variant. */
export function productJsonLd(product: ProductDetail, selected: ProductVariant | null): object {
  const price = selected?.price ?? product.price
  const availableForSale = selected ? selected.availableForSale : product.availableForSale

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: stripHtml(product.descriptionHtml),
    image: product.images.map((image) => image.url),
    sku: selected?.sku ?? undefined,
    brand: { '@type': 'Brand', name: BRAND_NAME },
    offers: {
      '@type': 'Offer',
      price: price.amount,
      priceCurrency: price.currencyCode,
      availability: availableForSale
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: productUrl(product, selected),
    },
  }
}

/** schema.org `BreadcrumbList`; `items` are already absolute URLs. */
export function breadcrumbJsonLd(items: { name: string; url: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/** schema.org `CollectionPage` wrapping an `ItemList` of the products on it. */
export function collectionJsonLd(
  collection: CollectionSummary,
  products: ProductCardData[]
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title,
    description: stripHtml(collection.description),
    url: siteUrl(`/collections/${collection.handle}`),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: product.title,
        url: siteUrl(`/products/${product.handle}`),
      })),
    },
  }
}

/** schema.org `Organization` for the store itself. */
export function organizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    url: siteUrl(),
    logo: siteUrl('/assets/logo.png'),
  }
}

export type JsonLdScriptProps = {
  type: 'application/ld+json'
  dangerouslySetInnerHTML: { __html: string }
}

/**
 * Props for a `<script>` carrying `schema`. `<` is escaped so a `</script>`
 * inside merchandiser copy cannot close the tag early.
 */
export function jsonLdScriptProps(schema: object): JsonLdScriptProps {
  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(schema).replace(/</g, '\\u003c') },
  }
}
