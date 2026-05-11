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
  /** Real cover image URL when available; null when the card should fall back to composite/gradient. */
  imageUrl: string | null
  /** Origin of the resolved imageUrl (or `'none'` when null). Lets the card pick a fallback. */
  imageSource: 'collection' | 'product' | 'none'
  /** Up to 4 product image URLs from this collection's products, used for the 2×2 composite fallback. */
  previewImages: string[]
  isFeatured: boolean
  productCount: number
}

export const COLLECTION_CAMPAIGN_VARIANTS = ['runway', 'atelier', 'gallery'] as const
export type CollectionCampaignVariant = (typeof COLLECTION_CAMPAIGN_VARIANTS)[number]

export interface CollectionCampaignPresentation {
  variant: CollectionCampaignVariant
  accentLabel: string
  accentGradientClass: string
  cardSpanClass: string
  mediaAspectClass: string
}

export interface CollectionEditorialSection {
  id: string
  heading: string
  body: string
}

export const COLLECTION_DETAIL_INITIAL_PRODUCTS = 8
export const COLLECTION_DETAIL_LOAD_MORE_STEP = 8

const DEFAULT_COLLECTION_IMAGE = '/placeholder-product.jpg'

const CAMPAIGN_PRESENTATIONS: Record<CollectionCampaignVariant, Omit<CollectionCampaignPresentation, 'variant'>> = {
  runway: {
    accentLabel: 'Runway Edit',
    accentGradientClass:
      'from-neutral-900 via-neutral-700 to-stone-500 text-white border-white/20 shadow-black/30',
    cardSpanClass: 'lg:col-span-5',
    mediaAspectClass: 'aspect-[4/5]',
  },
  atelier: {
    accentLabel: 'Atelier Selection',
    accentGradientClass:
      'from-zinc-900 via-zinc-700 to-amber-200 text-white border-white/20 shadow-black/30',
    cardSpanClass: 'lg:col-span-4',
    mediaAspectClass: 'aspect-[4/3]',
  },
  gallery: {
    accentLabel: 'Gallery Collection',
    accentGradientClass:
      'from-neutral-800 via-stone-600 to-zinc-300 text-white border-white/25 shadow-black/25',
    cardSpanClass: 'lg:col-span-3',
    mediaAspectClass: 'aspect-[3/4]',
  },
}

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

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
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

/** Collect up to N unique product image URLs from a collection's products. */
function collectPreviewImages(collection: Pick<CollectionWithProducts, 'products'>, max = 4): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of collection.products) {
    for (const candidate of parseImages(row.product.images)) {
      if (!candidate || seen.has(candidate)) continue
      seen.add(candidate)
      out.push(candidate)
      if (out.length >= max) return out
    }
    if (out.length >= max) return out
  }
  return out
}

export function toCollectionCardViewModel(collection: CollectionWithProducts): CollectionCardViewModel {
  const hasOwnImage = !!(collection.image && collection.image.trim().length > 0)
  const previewImages = collectPreviewImages(collection, 4)

  let imageUrl: string | null
  let imageSource: CollectionCardViewModel['imageSource']

  if (hasOwnImage) {
    imageUrl = collection.image as string
    imageSource = 'collection'
  } else if (previewImages.length > 0) {
    // Prefer null here so the card chooses the composite fallback instead of
    // showing a single product image as a fake cover.
    imageUrl = null
    imageSource = 'product'
  } else {
    imageUrl = null
    imageSource = 'none'
  }

  return {
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    description: collection.description || 'Explore this curated collection.',
    imageUrl,
    imageSource,
    previewImages,
    isFeatured: collection.isFeatured,
    productCount: collection._count.products,
  }
}

export function resolveCollectionCampaignPresentation(slug: string, index: number): CollectionCampaignPresentation {
  const key = `${slug}:${index}`
  const variant = COLLECTION_CAMPAIGN_VARIANTS[hashString(key) % COLLECTION_CAMPAIGN_VARIANTS.length]
  const presentation = CAMPAIGN_PRESENTATIONS[variant]

  return {
    variant,
    ...presentation,
  }
}

export function buildCollectionEditorialSections(input: {
  name: string
  description: string | null | undefined
  productCount: number
  isFeatured: boolean
  sampleProducts?: string[]
}): CollectionEditorialSection[] {
  const summaryText =
    input.description?.trim() ||
    `${input.name} brings a focused edit of elevated staples for everyday expression.`
  const featuredText = input.isFeatured
    ? 'This featured collection highlights signature styles selected for standout wearability.'
    : 'This collection is curated for a cohesive wardrobe direction with premium essentials.'

  const sampleLabel = (input.sampleProducts ?? []).filter(Boolean).slice(0, 3).join(', ')

  return [
    {
      id: 'intent',
      heading: 'Collection Intent',
      body: summaryText,
    },
    {
      id: 'craft',
      heading: 'Craft & Composition',
      body: `${featuredText} ${input.productCount} pieces are currently available in this edit.`,
    },
    {
      id: 'style',
      heading: 'Styling Direction',
      body: sampleLabel
        ? `Build looks around ${sampleLabel}, then layer with accessories for a polished finish.`
        : 'Mix core pieces with textures and layers for a refined monochrome statement.',
    },
  ]
}

export function getVisibleCollectionProducts<T>(products: T[], visibleCount: number): T[] {
  return products.slice(0, Math.max(0, visibleCount))
}

export function getNextCollectionVisibleCount(params: {
  currentVisibleCount: number
  totalProducts: number
  step?: number
}): number {
  const step = params.step ?? COLLECTION_DETAIL_LOAD_MORE_STEP
  return Math.min(params.totalProducts, params.currentVisibleCount + step)
}
