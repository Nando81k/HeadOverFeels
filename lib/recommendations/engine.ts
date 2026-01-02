/**
 * Product Recommendation Engine
 * 
 * Algorithms for generating product recommendations:
 * - Similar products (content-based filtering)
 * - Frequently bought together (collaborative filtering)
 * - Personalized recommendations (user-based)
 * - Trending products (time-based popularity)
 */

import { prisma } from '@/lib/prisma'
import { RecommendationType } from '@prisma/client'

export interface ProductScore {
  productId: string
  score: number
  reason?: string
}

export interface RecommendationOptions {
  limit?: number
  excludeProductIds?: string[]
  minScore?: number
}

/**
 * Calculate similarity score between two products
 * Based on: category, price range, materials, tags
 */
export async function calculateProductSimilarity(
  productId1: string,
  productId2: string
): Promise<number> {
  const [product1, product2] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId1 },
      include: { category: true, collections: true },
    }),
    prisma.product.findUnique({
      where: { id: productId2 },
      include: { category: true, collections: true },
    }),
  ])

  if (!product1 || !product2) return 0

  let score = 0
  let maxScore = 0

  // Category similarity (40% weight)
  maxScore += 40
  if (product1.categoryId === product2.categoryId && product1.categoryId) {
    score += 40
  }

  // Price range similarity (30% weight)
  maxScore += 30
  const priceDiff = Math.abs(product1.price - product2.price)
  const avgPrice = (product1.price + product2.price) / 2
  const priceSimilarity = 1 - Math.min(priceDiff / avgPrice, 1)
  score += priceSimilarity * 30

  // Collection overlap (20% weight)
  maxScore += 20
  const collections1 = new Set(product1.collections.map(c => c.collectionId))
  const collections2 = new Set(product2.collections.map(c => c.collectionId))
  const overlap = [...collections1].filter(c => collections2.has(c)).length
  const total = collections1.size + collections2.size - overlap
  if (total > 0) {
    score += (overlap / total) * 20
  }

  // Materials similarity (10% weight)
  maxScore += 10
  if (product1.materials && product2.materials) {
    const materials1 = product1.materials.toLowerCase().split(/\s+/)
    const materials2 = product2.materials.toLowerCase().split(/\s+/)
    const materialOverlap = materials1.filter(m => materials2.includes(m)).length
    const materialTotal = new Set([...materials1, ...materials2]).size
    if (materialTotal > 0) {
      score += (materialOverlap / materialTotal) * 10
    }
  }

  return score / maxScore
}

/**
 * Get similar products using content-based filtering
 */
export async function getSimilarProducts(
  productId: string,
  options: RecommendationOptions = {}
): Promise<ProductScore[]> {
  const { limit = 6, excludeProductIds = [], minScore = 0.3 } = options

  // Check for cached recommendations first
  const cached = await prisma.productRecommendation.findMany({
    where: {
      sourceProductId: productId,
      type: RecommendationType.SIMILAR,
      score: { gte: minScore },
    },
    orderBy: { score: 'desc' },
    take: limit,
    include: { targetProduct: true },
  })

  if (cached.length >= limit) {
    return cached
      .filter(r => !excludeProductIds.includes(r.targetProductId))
      .map(r => ({
        productId: r.targetProductId,
        score: r.score,
        reason: r.reason || undefined,
      }))
  }

  // Calculate similarities on the fly
  const sourceProduct = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  })

  if (!sourceProduct) return []

  // Get all active products in same category
  const candidates = await prisma.product.findMany({
    where: {
      id: { not: productId, notIn: excludeProductIds },
      isActive: true,
      categoryId: sourceProduct.categoryId,
    },
    take: 50, // Limit candidate pool for performance
  })

  // Calculate similarities
  const scores: ProductScore[] = []
  for (const candidate of candidates) {
    const score = await calculateProductSimilarity(productId, candidate.id)
    if (score >= minScore) {
      scores.push({
        productId: candidate.id,
        score,
        reason: 'Similar style and category',
      })
    }
  }

  // Sort by score and return top results
  scores.sort((a, b) => b.score - a.score)
  return scores.slice(0, limit)
}

/**
 * Get frequently bought together products
 * Based on order co-occurrence patterns
 */
export async function getFrequentlyBoughtTogether(
  productId: string,
  options: RecommendationOptions = {}
): Promise<ProductScore[]> {
  const { limit = 4, excludeProductIds = [] } = options

  // Check cached recommendations
  const cached = await prisma.productRecommendation.findMany({
    where: {
      sourceProductId: productId,
      type: RecommendationType.FREQUENTLY_BOUGHT_TOGETHER,
    },
    orderBy: { score: 'desc' },
    take: limit,
    include: { targetProduct: true },
  })

  if (cached.length >= limit) {
    return cached
      .filter(r => !excludeProductIds.includes(r.targetProductId))
      .map(r => ({
        productId: r.targetProductId,
        score: r.score,
        reason: r.reason || 'Frequently bought together',
      }))
  }

  // Calculate from order data
  // Find all orders containing this product
  const ordersWithProduct = await prisma.order.findMany({
    where: {
      items: {
        some: {
          productId: productId,
        },
      },
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  // Count co-occurrences
  const coOccurrences = new Map<string, number>()
  const totalOrders = ordersWithProduct.length

  for (const order of ordersWithProduct) {
    const otherProducts = order.items
      .filter(
        item =>
          item.productId !== productId &&
          !excludeProductIds.includes(item.productId)
      )
      .map(item => item.productId)

    for (const otherId of otherProducts) {
      coOccurrences.set(otherId, (coOccurrences.get(otherId) || 0) + 1)
    }
  }

  // Calculate scores (normalized by total orders)
  const scores: ProductScore[] = []
  for (const [otherId, count] of coOccurrences.entries()) {
    const score = count / totalOrders
    scores.push({
      productId: otherId,
      score,
      reason: `Bought together ${count} time${count > 1 ? 's' : ''}`,
    })
  }

  scores.sort((a, b) => b.score - a.score)
  return scores.slice(0, limit)
}

/**
 * Get personalized recommendations based on user behavior
 */
export async function getPersonalizedRecommendations(
  customerId: string,
  options: RecommendationOptions = {}
): Promise<ProductScore[]> {
  const { limit = 8, excludeProductIds = [] } = options

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      orders: {
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      },
      productViews: {
        orderBy: { viewedAt: 'desc' },
        take: 20,
        include: { product: true },
      },
    },
  })

  if (!customer) return []

  // Get categories from purchase history
  const purchasedCategories = new Set<string>()
  const purchasedProducts = new Set<string>()

  for (const order of customer.orders) {
    for (const item of order.items) {
      if (item.product.categoryId) {
        purchasedCategories.add(item.product.categoryId)
      }
      purchasedProducts.add(item.product.id)
    }
  }

  // Get categories from browsing history
  const viewedCategories = new Set<string>()
  const viewedProducts = new Set<string>()

  for (const view of customer.productViews) {
    if (view.product.categoryId) {
      viewedCategories.add(view.product.categoryId)
    }
    viewedProducts.add(view.product.id)
  }

  // Combine categories (purchases weighted higher)
  const categoryScores = new Map<string, number>()
  for (const catId of purchasedCategories) {
    categoryScores.set(catId, (categoryScores.get(catId) || 0) + 2)
  }
  for (const catId of viewedCategories) {
    categoryScores.set(catId, (categoryScores.get(catId) || 0) + 1)
  }

  // Get products from preferred categories
  const preferredCategories = [...categoryScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([catId]) => catId)

  const candidates = await prisma.product.findMany({
    where: {
      categoryId: { in: preferredCategories },
      id: {
        notIn: [
          ...purchasedProducts,
          ...viewedProducts,
          ...excludeProductIds,
        ],
      },
      isActive: true,
      isFeatured: true, // Prioritize featured products
    },
    take: limit * 2,
    orderBy: [{ isFeaturedNewArrival: 'desc' }, { createdAt: 'desc' }],
  })

  // Score based on category preference
  const scores: ProductScore[] = candidates.map(product => {
    const categoryScore = categoryScores.get(product.categoryId || '') || 0
    const maxCategoryScore = Math.max(...categoryScores.values())
    const score = categoryScore / maxCategoryScore

    return {
      productId: product.id,
      score,
      reason: 'Based on your shopping history',
    }
  })

  scores.sort((a, b) => b.score - a.score)
  return scores.slice(0, limit)
}

/**
 * Get trending products
 * Based on recent views and purchases
 */
export async function getTrendingProducts(
  options: RecommendationOptions = {}
): Promise<ProductScore[]> {
  const { limit = 8, excludeProductIds = [] } = options

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Get view counts for last 7 days
  const viewCounts = await prisma.productView.groupBy({
    by: ['productId'],
    where: {
      viewedAt: { gte: oneWeekAgo },
      productId: { notIn: excludeProductIds },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit * 2,
  })

  // Get purchase counts for last 24 hours (weighted higher) - group by productId directly
  const purchaseCounts = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        createdAt: { gte: oneDayAgo },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
    },
    _count: { id: true },
  })

  // Create map of purchases by product
  const purchasesByProduct = new Map<string, number>()
  for (const purchase of purchaseCounts) {
    purchasesByProduct.set(purchase.productId, purchase._count?.id || 0)
  }

  // Calculate trending score: views + (purchases * 5)
  const scores: ProductScore[] = []
  const maxViews = viewCounts[0]?._count.id || 1
  const maxPurchases = Math.max(...purchasesByProduct.values(), 1)

  for (const { productId, _count } of viewCounts) {
    const viewScore = _count.id / maxViews
    const purchases = purchasesByProduct.get(productId) || 0
    const purchaseScore = purchases / maxPurchases
    
    // Weighted combination: 40% views, 60% purchases
    const score = viewScore * 0.4 + purchaseScore * 0.6

    scores.push({
      productId,
      score,
      reason: `${_count.id} views, ${purchases} purchases recently`,
    })
  }

  // Add products with high purchases but low views
  for (const [productId, purchases] of purchasesByProduct.entries()) {
    if (!scores.find(s => s.productId === productId)) {
      const purchaseScore = purchases / maxPurchases
      scores.push({
        productId,
        score: purchaseScore * 0.6,
        reason: `${purchases} purchases recently`,
      })
    }
  }

  scores.sort((a, b) => b.score - a.score)
  return scores.slice(0, limit)
}

/**
 * Cache recommendations in database for performance
 */
export async function cacheRecommendations(
  sourceProductId: string,
  type: RecommendationType,
  recommendations: ProductScore[]
): Promise<void> {
  // Delete existing cached recommendations
  await prisma.productRecommendation.deleteMany({
    where: {
      sourceProductId,
      type,
    },
  })

  // Create new cached recommendations
  await prisma.productRecommendation.createMany({
    data: recommendations.map(rec => ({
      sourceProductId,
      targetProductId: rec.productId,
      type,
      score: rec.score,
      reason: rec.reason,
    })),
  })
}

/**
 * Track recommendation impression
 */
export async function trackRecommendationImpression(
  sourceProductId: string,
  targetProductId: string,
  type: RecommendationType
): Promise<void> {
  await prisma.productRecommendation.updateMany({
    where: {
      sourceProductId,
      targetProductId,
      type,
    },
    data: {
      impressions: { increment: 1 },
    },
  })
}

/**
 * Track recommendation click
 */
export async function trackRecommendationClick(
  sourceProductId: string,
  targetProductId: string,
  type: RecommendationType
): Promise<void> {
  await prisma.productRecommendation.updateMany({
    where: {
      sourceProductId,
      targetProductId,
      type,
    },
    data: {
      clicks: { increment: 1 },
    },
  })
}

/**
 * Track recommendation conversion (purchase)
 */
export async function trackRecommendationConversion(
  sourceProductId: string,
  targetProductId: string,
  type: RecommendationType,
  revenue: number
): Promise<void> {
  await prisma.productRecommendation.updateMany({
    where: {
      sourceProductId,
      targetProductId,
      type,
    },
    data: {
      conversions: { increment: 1 },
      revenue: { increment: revenue },
    },
  })
}
