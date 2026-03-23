import type { Product } from '@/lib/api/products'

export const COLLECTION_LIST_SORT_OPTIONS = ['curated', 'name', 'productCount'] as const
export type CollectionListSortBy = (typeof COLLECTION_LIST_SORT_OPTIONS)[number]

export const COLLECTION_PRODUCT_SORT_OPTIONS = [
  'curated',
  'newest',
  'priceAsc',
  'priceDesc',
  'name',
] as const
export type CollectionProductSortBy = (typeof COLLECTION_PRODUCT_SORT_OPTIONS)[number]

export type CollectionFeaturedFilter = 'all' | 'featured'

export interface CollectionWithProducts {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  products: {
    product: Product
    sortOrder: number
  }[]
  _count: {
    products: number
  }
}

export interface CollectionCardViewModel {
  id: string
  name: string
  slug: string
  description: string
  imageUrl: string
  isFeatured: boolean
  productCount: number
}

const DEFAULT_COLLECTION_IMAGE = '/placeholder-product.jpg'

function parseImages(images: unknown): string[] {
  if (!images) return []

  if (Array.isArray(images)) {
    return images
      .map((image) => (typeof image === 'string' ? image : image?.url))
      .filter((image): image is string => Boolean(image))
  }

  if (typeof images === 'string') {
    const raw = images.trim()
    if (!raw) return []

    if (raw.startsWith('/') || raw.startsWith('http')) {
      return [raw]
    }

    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((image) => (typeof image === 'string' ? image : image?.url))
        .filter((image): image is string => Boolean(image))
    } catch {
      return []
    }
  }

  return []
}

export function normalizeCollectionListSortBy(value: string | null | undefined): CollectionListSortBy {
  if (!value) return 'curated'
  return COLLECTION_LIST_SORT_OPTIONS.includes(value as CollectionListSortBy)
    ? (value as CollectionListSortBy)
    : 'curated'
}

export function normalizeCollectionProductSortBy(value: string | null | undefined): CollectionProductSortBy {
  if (!value) return 'curated'
  return COLLECTION_PRODUCT_SORT_OPTIONS.includes(value as CollectionProductSortBy)
    ? (value as CollectionProductSortBy)
    : 'curated'
}

export function normalizeCollectionFeaturedFilter(value: string | null | undefined): CollectionFeaturedFilter {
  if (!value) return 'all'
  return value === 'featured' || value === 'true' ? 'featured' : 'all'
}

export function normalizeLegacyCollectionSlug(value: string): string {
  return decodeURIComponent(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function resolveCollectionCoverImage(collection: Pick<CollectionWithProducts, 'image' | 'products'>): string {
  if (collection.image && collection.image.trim().length > 0) {
    return collection.image
  }

  for (const row of collection.products) {
    const candidate = parseImages(row.product.images)[0]
    if (candidate) {
      return candidate
    }
  }

  return DEFAULT_COLLECTION_IMAGE
}

export function toCollectionCardViewModel(collection: CollectionWithProducts): CollectionCardViewModel {
  return {
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    description: collection.description || 'Explore this curated collection.',
    imageUrl: resolveCollectionCoverImage(collection),
    isFeatured: collection.isFeatured,
    productCount: collection._count.products,
  }
}

