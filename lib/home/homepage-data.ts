import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client'
import type {
  HomeCategoryCard,
  HomePageData,
  HomeProductCard,
  HomeReviewHighlight,
  HomeReviewSummary,
} from '@/components/home/types'
import {
  buildVariantPlaceholderImages,
  getPrimaryImageWithFallback,
  parseImageList as parseImageListFromUtility,
  resolveColorHex,
} from '@/lib/commerce/product-placeholders'
import { prisma } from '@/lib/prisma'
import { getTrendingProducts } from '@/lib/recommendations/engine'

const LOW_STOCK_THRESHOLD = 6

const HOME_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  images: true,
  createdAt: true,
  category: {
    select: {
      name: true,
      slug: true,
    },
  },
  variants: {
    where: {
      isActive: true,
    },
    select: {
      id: true,
      color: true,
      colorHex: true,
      images: true,
      inventory: true,
    },
  },
} satisfies Prisma.ProductSelect

type HomeProductRecord = Prisma.ProductGetPayload<{
  select: typeof HOME_PRODUCT_SELECT
}>

type ReviewHighlightRecord = {
  id: string
  rating: number
  comment: string
  customerName: string
  product: {
    name: string
    slug: string
  }
}

const COMPLETED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
]

function normalizeCategoryImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) {
    return null
  }

  const trimmed = imageUrl.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.hostname === 'cdn.headoverfeels.com' && parsed.pathname.startsWith('/categories/')) {
      return null
    }
  } catch {
    // Relative paths are valid fallbacks for local assets.
  }

  return trimmed
}

export function parseImageList(value: unknown): string[] {
  return parseImageListFromUtility(value)
}

function normalizeColorCues(
  productName: string,
  productSlug: string,
  variants: Array<{
    color: string | null
    colorHex: string | null
    images: string | null
  }>
): HomeProductCard['colorCues'] {
  const cues: HomeProductCard['colorCues'] = []
  const seen = new Set<string>()

  for (const variant of variants) {
    const label = variant.color?.trim()
    const hex = resolveColorHex(variant.colorHex, label)

    if (!label || !hex) {
      continue
    }

    const dedupeKey = `${label.toLowerCase()}::${hex.toLowerCase()}`
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    const previewImageUrl =
      parseImageList(variant.images)[0] ||
      buildVariantPlaceholderImages({
        productName,
        productSlug,
        color: label,
        colorHex: hex,
      })[0]
    cues.push({
      label,
      hex,
      previewImageUrl,
    })

    if (cues.length === 4) {
      break
    }
  }

  return cues
}

export function normalizeHomeProductCard(product: HomeProductRecord): HomeProductCard {
  const imageUrl = getPrimaryImageWithFallback({
    images: product.images,
    productName: product.name,
    productSlug: product.slug,
  })

  const totalInventory = product.variants.reduce((total, variant) => {
    return total + Math.max(0, variant.inventory)
  }, 0)

  const hasVariants = product.variants.length > 0
  const isSoldOut = hasVariants && totalInventory <= 0
  const lowStockLabel =
    hasVariants && totalInventory > 0 && totalInventory < LOW_STOCK_THRESHOLD
      ? `Only ${totalInventory} left`
      : undefined

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    imageUrl,
    categoryName: product.category?.name,
    isSoldOut,
    lowStockLabel,
    colorCues: normalizeColorCues(product.name, product.slug, product.variants),
  }
}

export function mergePrimaryWithFallback(
  primary: HomeProductCard[],
  fallback: HomeProductCard[],
  limit: number
): HomeProductCard[] {
  const combined: HomeProductCard[] = []
  const seenIds = new Set<string>()

  for (const product of primary) {
    if (seenIds.has(product.id)) {
      continue
    }

    combined.push(product)
    seenIds.add(product.id)

    if (combined.length >= limit) {
      return combined
    }
  }

  for (const product of fallback) {
    if (seenIds.has(product.id)) {
      continue
    }

    combined.push(product)
    seenIds.add(product.id)

    if (combined.length >= limit) {
      return combined
    }
  }

  return combined
}

export function buildReviewSummary(averageRating: number | null, totalReviews: number): HomeReviewSummary {
  return {
    averageRating: averageRating ? Number(averageRating.toFixed(1)) : 0,
    totalReviews,
  }
}

export function normalizeReviewHighlights(
  reviews: ReviewHighlightRecord[],
  limit: number = 3
): HomeReviewHighlight[] {
  return reviews.slice(0, limit).map((review) => {
    const cleanedComment = review.comment.replace(/\s+/g, ' ').trim()
    const snippet =
      cleanedComment.length > 180
        ? `${cleanedComment.slice(0, 177).trimEnd()}...`
        : cleanedComment

    return {
      id: review.id,
      productName: review.product.name,
      productSlug: review.product.slug,
      customerName: review.customerName,
      rating: review.rating,
      snippet,
    }
  })
}

async function fetchBestSellerProducts(limit: number): Promise<HomeProductRecord[]> {
  const bestSellerRows = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        status: {
          in: COMPLETED_ORDER_STATUSES,
        },
      },
    },
    _sum: {
      quantity: true,
    },
    orderBy: {
      _sum: {
        quantity: 'desc',
      },
    },
    take: limit,
  })

  if (bestSellerRows.length === 0) {
    return []
  }

  const orderedIds = bestSellerRows.map((row) => row.productId)
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: orderedIds,
      },
      isActive: true,
    },
    select: HOME_PRODUCT_SELECT,
  })

  const byId = new Map(products.map((product) => [product.id, product]))

  return orderedIds
    .map((id) => byId.get(id) ?? null)
    .filter((product): product is HomeProductRecord => Boolean(product))
}

async function fetchNewArrivalProducts(limit: number): Promise<HomeProductRecord[]> {
  const featuredNewArrivals = await prisma.product.findMany({
    where: {
      isActive: true,
      isFeaturedNewArrival: true,
    },
    select: HOME_PRODUCT_SELECT,
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  })

  if (featuredNewArrivals.length >= limit) {
    return featuredNewArrivals
  }

  const remainder = limit - featuredNewArrivals.length
  const excludeIds = featuredNewArrivals.map((product) => product.id)

  const newestFallback = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(excludeIds.length > 0
        ? {
            id: {
              notIn: excludeIds,
            },
          }
        : {}),
    },
    select: HOME_PRODUCT_SELECT,
    orderBy: [{ createdAt: 'desc' }],
    take: remainder,
  })

  return [...featuredNewArrivals, ...newestFallback]
}

async function fetchTrendingProducts(limit: number): Promise<HomeProductRecord[]> {
  const trending = await getTrendingProducts({ limit })

  if (trending.length === 0) {
    return []
  }

  const orderedIds = trending.map((row) => row.productId)
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: orderedIds,
      },
      isActive: true,
    },
    select: HOME_PRODUCT_SELECT,
  })

  const byId = new Map(products.map((product) => [product.id, product]))

  return orderedIds
    .map((id) => byId.get(id) ?? null)
    .filter((product): product is HomeProductRecord => Boolean(product))
}

async function fetchFallbackProducts(limit: number): Promise<HomeProductRecord[]> {
  return prisma.product.findMany({
    where: {
      isActive: true,
    },
    select: HOME_PRODUCT_SELECT,
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
}

async function fetchCategoryCards(limit: number): Promise<HomeCategoryCard[]> {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: limit,
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      _count: {
        select: {
          products: true,
        },
      },
      products: {
        where: {
          isActive: true,
        },
        select: {
          images: true,
        },
        take: 1,
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  return categories.map((category) => {
    const productImage = parseImageList(category.products[0]?.images)[0]
    const categoryImage = normalizeCategoryImageUrl(category.image)
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      href: `/products?category=${encodeURIComponent(category.slug)}`,
      imageUrl:
        categoryImage ??
        productImage ??
        getPrimaryImageWithFallback({
          images: '',
          productName: `${category.name} Collection`,
          productSlug: category.slug,
        }),
      productCount: category._count.products,
    }
  })
}

async function fetchReviewData(highlightLimit: number): Promise<{
  summary: HomeReviewSummary
  highlights: HomeReviewHighlight[]
}> {
  const [aggregate, highlights] = await Promise.all([
    prisma.review.aggregate({
      where: {
        status: ReviewStatus.APPROVED,
        product: {
          isActive: true,
        },
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.review.findMany({
      where: {
        status: ReviewStatus.APPROVED,
        product: {
          isActive: true,
        },
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        customerName: true,
        product: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
      take: highlightLimit,
    }),
  ])

  return {
    summary: buildReviewSummary(aggregate._avg.rating, aggregate._count.id),
    highlights: normalizeReviewHighlights(highlights, highlightLimit),
  }
}

export interface LoadHomePageDataOptions {
  productLimit?: number
  categoryLimit?: number
  reviewHighlightLimit?: number
}

export async function loadHomePageData(
  options: LoadHomePageDataOptions = {}
): Promise<HomePageData> {
  const productLimit = options.productLimit ?? 8
  const categoryLimit = options.categoryLimit ?? 6
  const reviewHighlightLimit = options.reviewHighlightLimit ?? 3

  const [
    bestSellerProducts,
    newArrivalProducts,
    trendingProducts,
    fallbackProducts,
    categoryCards,
    reviewData,
  ] = await Promise.all([
    fetchBestSellerProducts(productLimit),
    fetchNewArrivalProducts(productLimit),
    fetchTrendingProducts(productLimit),
    fetchFallbackProducts(productLimit * 2),
    fetchCategoryCards(categoryLimit),
    fetchReviewData(reviewHighlightLimit),
  ])

  const fallbackCards = fallbackProducts.map(normalizeHomeProductCard)

  return {
    bestSellers: mergePrimaryWithFallback(
      bestSellerProducts.map(normalizeHomeProductCard),
      fallbackCards,
      productLimit
    ),
    newArrivals: mergePrimaryWithFallback(
      newArrivalProducts.map(normalizeHomeProductCard),
      fallbackCards,
      productLimit
    ),
    trending: mergePrimaryWithFallback(
      trendingProducts.map(normalizeHomeProductCard),
      fallbackCards,
      productLimit
    ),
    categories: categoryCards,
    reviewSummary: reviewData.summary,
    reviewHighlights: reviewData.highlights,
  }
}
