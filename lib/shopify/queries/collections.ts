import { storefrontFetch } from '../client'
import type { CollectionSummary } from '../types'
import { CATALOG_REVALIDATE, IMAGE_FIELDS, toImage, type RawImage } from './fragments'

export const COLLECTIONS_QUERY = `query Collections($first: Int!) {
  collections(first: $first, sortKey: TITLE) {
    nodes { id handle title image { ...ImageFields } }
  }
}

${IMAGE_FIELDS}`

export type RawCollectionSummary = {
  id: string
  handle: string
  title: string
  image: RawImage | null
}

type CollectionsResponse = { collections: { nodes: RawCollectionSummary[] } | null }

export function normalizeCollections(nodes: RawCollectionSummary[]): CollectionSummary[] {
  return nodes.map((node) => ({
    id: node.id,
    handle: node.handle,
    title: node.title,
    image: toImage(node.image),
  }))
}

export async function getCollections(first = 50): Promise<CollectionSummary[]> {
  const data = await storefrontFetch<CollectionsResponse>(COLLECTIONS_QUERY, {
    variables: { first },
    tags: ['collections'],
    revalidate: CATALOG_REVALIDATE,
  })
  return normalizeCollections(data.collections?.nodes ?? [])
}
