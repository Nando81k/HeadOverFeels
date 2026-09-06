import { storefrontFetch } from '../client'
import type { CollectionSummary, SearchSuggestion } from '../types'
import { PRODUCT_CARD_FIELDS, toProductCard, type RawProductCard } from './fragments'

export const PREDICTIVE_SEARCH_QUERY = `query PredictiveSearch($q: String!) {
  predictiveSearch(query: $q, limit: 6, types: [PRODUCT, COLLECTION]) {
    products { ...ProductCardFields }
    collections { id handle title }
  }
}

${PRODUCT_CARD_FIELDS}`

/** Shopify's predictive search ignores anything shorter than this. */
export const MIN_SEARCH_LENGTH = 2

export type RawPredictiveSearch = {
  predictiveSearch: {
    products: RawProductCard[] | null
    collections: { id: string; handle: string; title: string }[] | null
  } | null
}

const EMPTY_SUGGESTION: SearchSuggestion = { products: [], collections: [] }

export function normalizePredictiveSearch(raw: RawPredictiveSearch): SearchSuggestion {
  const result = raw.predictiveSearch
  if (!result) return { products: [], collections: [] }
  const collections: CollectionSummary[] = (result.collections ?? []).map((collection) => ({
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
    image: null,
    description: null,
    featured: false,
  }))
  return { products: (result.products ?? []).map(toProductCard), collections }
}

/**
 * Type-ahead suggestions. Never cached (`revalidate: false`) and never fetched
 * for a query Shopify would reject anyway.
 */
export async function getPredictiveSearch(q: string): Promise<SearchSuggestion> {
  const query = q.trim()
  if (query.length < MIN_SEARCH_LENGTH) return { ...EMPTY_SUGGESTION }

  const data = await storefrontFetch<RawPredictiveSearch>(PREDICTIVE_SEARCH_QUERY, {
    variables: { q: query },
    tags: ['search'],
    revalidate: false,
  })
  return normalizePredictiveSearch(data)
}
