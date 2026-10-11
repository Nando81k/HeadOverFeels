import { storefrontFetch } from '../client'
import type { Money, ShopImage } from '../types'
import { isHigher, toImage, toMoney, type RawImage, type RawMoney } from './fragments'

/**
 * Variant lookup by id — the wishlist's card data source.
 *
 * Validated against Storefront API 2026-07 on 2026-10-11 (Phase 4 plan, Task 4):
 *
 *   query VariantsById($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id title
 *   availableForSale quantityAvailable price { amount currencyCode } compareAtPrice { amount
 *   currencyCode } selectedOptions { name value } image { url altText width height } product {
 *   id handle title tags availableForSale featuredImage { url altText width height } } } } }
 *
 * `nodes(ids:)` accepts at most 250 ids per call and answers `null` for an id that no
 * longer exists (deleted / unpublished variant) and `{}` for an id of another type, so
 * the normaliser drops both. The query spreads no shared fragments on purpose: every
 * field is inline, which keeps the document self-contained for the e2e mock.
 */
export const VARIANTS_BY_ID_QUERY = `query VariantsById($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id title availableForSale quantityAvailable price { amount currencyCode } compareAtPrice { amount currencyCode } selectedOptions { name value } image { url altText width height } product { id handle title tags availableForSale featuredImage { url altText width height } } } } }`

/** Ids per `nodes(ids:)` request. Well under Shopify's 250 cap to keep responses small. */
export const VARIANTS_CHUNK_SIZE = 50

/** Wishlist cards show live price / stock, so they refresh faster than catalog reads. */
export const VARIANTS_REVALIDATE = 60

/** Cache tag shared by every variant lookup. */
export const VARIANTS_TAG = 'variants'

// ---------------------------------------------------------------- domain type

/**
 * A variant with just enough of its product to render a wishlist card.
 * Phase 4 Task 1 mirrors this shape into `lib/shopify/types.ts`.
 */
export type ProductCardVariant = {
  id: string
  title: string
  availableForSale: boolean
  quantityAvailable: number | null
  price: Money
  compareAtPrice: Money | null
  selectedOptions: { name: string; value: string }[]
  image: ShopImage | null
  product: {
    id: string
    handle: string
    title: string
    tags: string[]
    availableForSale: boolean
    featuredImage: ShopImage | null
  }
}

// ---------------------------------------------------------------- raw shapes

export type RawVariantProduct = {
  id: string
  handle: string
  title: string
  tags: string[]
  availableForSale: boolean
  featuredImage: RawImage | null
}

export type RawVariantNode = {
  id: string
  title: string
  availableForSale: boolean
  quantityAvailable: number | null
  price: RawMoney
  compareAtPrice: RawMoney | null
  selectedOptions: { name: string; value: string }[]
  image: RawImage | null
  product: RawVariantProduct
}

/** A `nodes(ids:)` entry: a variant, `{}` for a node of another type, or `null` when missing. */
export type RawVariantsResponse = { nodes: (RawVariantNode | Record<string, unknown> | null)[] | null }

// ---------------------------------------------------------------- normalisers

/** True only for a node that resolved the `... on ProductVariant` fragment. */
export function isRawVariantNode(node: unknown): node is RawVariantNode {
  if (!node || typeof node !== 'object') return false
  const candidate = node as Partial<RawVariantNode>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.startsWith('gid://shopify/ProductVariant/') &&
    typeof candidate.price === 'object' &&
    candidate.price !== null &&
    typeof candidate.product === 'object' &&
    candidate.product !== null
  )
}

export function toProductCardVariant(raw: RawVariantNode): ProductCardVariant {
  const onSale = isHigher(raw.compareAtPrice, raw.price)
  return {
    id: raw.id,
    title: raw.title,
    availableForSale: raw.availableForSale,
    quantityAvailable: raw.quantityAvailable ?? null,
    price: toMoney(raw.price),
    compareAtPrice: onSale && raw.compareAtPrice ? toMoney(raw.compareAtPrice) : null,
    selectedOptions: (raw.selectedOptions ?? []).map((option) => ({
      name: option.name,
      value: option.value,
    })),
    image: toImage(raw.image),
    product: {
      id: raw.product.id,
      handle: raw.product.handle,
      title: raw.product.title,
      tags: raw.product.tags ?? [],
      availableForSale: raw.product.availableForSale,
      featuredImage: toImage(raw.product.featuredImage),
    },
  }
}

/** Drops `null` (deleted) and non-variant nodes; keeps the response order. */
export function normalizeVariantNodes(nodes: RawVariantsResponse['nodes']): ProductCardVariant[] {
  return (nodes ?? []).filter(isRawVariantNode).map(toProductCardVariant)
}

// ---------------------------------------------------------------- fetcher

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

/**
 * Looks up variants by gid, in chunks of `VARIANTS_CHUNK_SIZE`, and returns the ones
 * that still exist in the order the ids were given (duplicates collapsed). Missing or
 * non-variant ids are simply absent from the result — the caller treats that as "no
 * longer available".
 */
export async function getVariantsByIds(ids: string[]): Promise<ProductCardVariant[]> {
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) return []

  const pages = await Promise.all(
    chunk(unique, VARIANTS_CHUNK_SIZE).map((batch) =>
      storefrontFetch<RawVariantsResponse>(VARIANTS_BY_ID_QUERY, {
        variables: { ids: batch },
        tags: [VARIANTS_TAG],
        revalidate: VARIANTS_REVALIDATE,
      })
    )
  )

  const byId = new Map<string, ProductCardVariant>()
  for (const page of pages) {
    for (const variant of normalizeVariantNodes(page.nodes)) byId.set(variant.id, variant)
  }

  const ordered: ProductCardVariant[] = []
  for (const id of unique) {
    const variant = byId.get(id)
    if (variant) ordered.push(variant)
  }
  return ordered
}
