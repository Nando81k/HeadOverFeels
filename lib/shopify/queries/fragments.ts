/**
 * Shared Storefront GraphQL fragments and the product-card normaliser.
 *
 * The fragment strings are copied verbatim from the Phase 1 plan's "Shared
 * contracts" section (validated against Storefront API 2026-07). Documents are
 * composed by string concatenation; `PRODUCT_CARD_FIELDS` already carries
 * `ImageFields` and `MoneyFields`, so a document that spreads
 * `...ProductCardFields` must NOT append them a second time — a duplicate
 * fragment definition is a GraphQL validation error.
 */

import type { Money, ProductCardData, ShopImage } from '../types'

/** Default `revalidate` for catalog reads (plan: 300s for catalog, false for cart/search). */
export const CATALOG_REVALIDATE = 300

export const IMAGE_FIELDS = `fragment ImageFields on Image {
  url
  altText
  width
  height
}`

export const MONEY_FIELDS = `fragment MoneyFields on MoneyV2 {
  amount
  currencyCode
}`

export const PRODUCT_CARD_FIELDS = `fragment ProductCardFields on Product {
  id
  handle
  title
  availableForSale
  tags
  featuredImage { ...ImageFields }
  images(first: 2) { nodes { ...ImageFields } }
  priceRange { minVariantPrice { ...MoneyFields } }
  compareAtPriceRange { minVariantPrice { ...MoneyFields } }
  options { name optionValues { name swatch { color } } }
}

${IMAGE_FIELDS}

${MONEY_FIELDS}`

// ---------------------------------------------------------------- raw shapes

export type RawImage = {
  url: string
  altText: string | null
  width: number | null
  height: number | null
}

export type RawMoney = { amount: string; currencyCode: string }

export type RawOptionValue = { name: string; swatch: { color: string | null } | null }
export type RawOption = { name: string; optionValues: RawOptionValue[] }

export type RawProductCard = {
  id: string
  handle: string
  title: string
  availableForSale: boolean
  tags: string[]
  featuredImage: RawImage | null
  images: { nodes: RawImage[] } | null
  priceRange: { minVariantPrice: RawMoney }
  compareAtPriceRange: { minVariantPrice: RawMoney } | null
  options: RawOption[] | null
}

// ---------------------------------------------------------------- normalisers

/** The option names Shopify merchants use for colour, in both spellings. */
const COLOR_OPTION_NAMES = new Set(['color', 'colour'])

export function isColorOptionName(name: string): boolean {
  return COLOR_OPTION_NAMES.has(name.trim().toLowerCase())
}

export function toImage(raw: RawImage | null | undefined): ShopImage | null {
  if (!raw) return null
  return {
    url: raw.url,
    altText: raw.altText ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
  }
}

export function toMoney(raw: RawMoney): Money {
  return { amount: raw.amount, currencyCode: raw.currencyCode }
}

/** Decimal-string money compare. Non-numeric input never counts as "higher". */
export function isHigher(a: RawMoney | null | undefined, b: RawMoney | null | undefined): boolean {
  if (!a || !b) return false
  const left = Number(a.amount)
  const right = Number(b.amount)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false
  return left > right
}

/**
 * Normalises a `ProductCardFields` selection into the storefront domain type.
 * Shared by the PDP, collection, search and recommendation queries.
 */
export function toProductCard(raw: RawProductCard): ProductCardData {
  const gallery = raw.images?.nodes ?? []
  const image = toImage(raw.featuredImage) ?? toImage(gallery[0])
  const hoverImage = image
    ? toImage(gallery.find((node) => node.url !== image.url))
    : null

  const rawCompareAt = raw.compareAtPriceRange?.minVariantPrice ?? null
  const onSale = isHigher(rawCompareAt, raw.priceRange.minVariantPrice)

  const colorOption = (raw.options ?? []).find((option) => isColorOptionName(option.name))
  const swatches = (colorOption?.optionValues ?? []).map((value) => ({
    name: value.name,
    color: value.swatch?.color ?? null,
  }))

  const badges: ProductCardData['badges'] = []
  if (onSale) badges.push('sale')
  if (raw.tags.includes('drop')) badges.push('drop')
  if (raw.tags.includes('new-arrival')) badges.push('new')
  if (!raw.availableForSale) badges.push('soldout')

  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    availableForSale: raw.availableForSale,
    image,
    hoverImage,
    price: toMoney(raw.priceRange.minVariantPrice),
    compareAtPrice: onSale && rawCompareAt ? toMoney(rawCompareAt) : null,
    swatches,
    badges,
  }
}
