import { storefrontFetch } from '../client'
import type { ProductCardData } from '../types'
import {
  CATALOG_REVALIDATE,
  PRODUCT_CARD_FIELDS,
  toProductCard,
  type RawProductCard,
} from './fragments'

export const RECOMMENDATIONS_QUERY = `query Recommendations($handle: String!) {
  productRecommendations(productHandle: $handle, intent: COMPLEMENTARY) {
    ...ProductCardFields
  }
}

${PRODUCT_CARD_FIELDS}`

export type RawRecommendations = { productRecommendations: RawProductCard[] | null }

export function normalizeRecommendations(raw: RawRecommendations): ProductCardData[] {
  return (raw.productRecommendations ?? []).map(toProductCard)
}

/**
 * Complementary products for a PDP. Shopify returns `null` until the store has
 * enough order history, so an empty array is the normal early-life answer.
 */
export async function getRecommendations(handle: string): Promise<ProductCardData[]> {
  const data = await storefrontFetch<RawRecommendations>(RECOMMENDATIONS_QUERY, {
    variables: { handle },
    tags: [`product:${handle}`],
    revalidate: CATALOG_REVALIDATE,
  })
  return normalizeRecommendations(data)
}
