/**
 * Recommendation Tracking Service
 * 
 * Tracks impressions, clicks, and conversions for product recommendations
 * to measure and improve recommendation effectiveness.
 */

import { prisma } from '@/lib/prisma'
import { RecommendationType } from '@prisma/client'

// ===== TYPES =====

export interface TrackImpressionInput {
  sourceProductId: string
  targetProductId: string
  type: RecommendationType
}

export interface TrackClickInput {
  sourceProductId: string
  targetProductId: string
  type: RecommendationType
}

export interface TrackConversionInput {
  sourceProductId: string
  targetProductId: string
  type: RecommendationType
  revenue: number
}

export interface RecommendationAnalytics {
  type: RecommendationType
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  totalRevenue: number
  clickThroughRate: number
  conversionRate: number
}

// ===== TRACKING FUNCTIONS =====

/**
 * Track when a recommendation is displayed (impression)
 */
export async function trackImpression(input: TrackImpressionInput): Promise<void> {
  try {
    await prisma.productRecommendation.updateMany({
      where: {
        sourceProductId: input.sourceProductId,
        targetProductId: input.targetProductId,
        type: input.type,
      },
      data: {
        impressions: { increment: 1 },
      },
    })
  } catch (error) {
    console.error('Failed to track recommendation impression:', error)
  }
}

/**
 * Track batch impressions (more efficient for carousels)
 */
export async function trackBatchImpressions(
  sourceProductId: string,
  targetProductIds: string[],
  type: RecommendationType
): Promise<void> {
  try {
    await prisma.productRecommendation.updateMany({
      where: {
        sourceProductId,
        targetProductId: { in: targetProductIds },
        type,
      },
      data: {
        impressions: { increment: 1 },
      },
    })
  } catch (error) {
    console.error('Failed to track batch impressions:', error)
  }
}

/**
 * Track when a user clicks on a recommended product
 */
export async function trackClick(input: TrackClickInput): Promise<void> {
  try {
    await prisma.productRecommendation.updateMany({
      where: {
        sourceProductId: input.sourceProductId,
        targetProductId: input.targetProductId,
        type: input.type,
      },
      data: {
        clicks: { increment: 1 },
      },
    })
  } catch (error) {
    console.error('Failed to track recommendation click:', error)
  }
}

/**
 * Track when a recommendation leads to a purchase (conversion)
 */
export async function trackConversion(input: TrackConversionInput): Promise<void> {
  try {
    await prisma.productRecommendation.updateMany({
      where: {
        sourceProductId: input.sourceProductId,
        targetProductId: input.targetProductId,
        type: input.type,
      },
      data: {
        conversions: { increment: 1 },
        revenue: { increment: input.revenue },
      },
    })
  } catch (error) {
    console.error('Failed to track recommendation conversion:', error)
  }
}

/**
 * Track conversions from an order (called after order completion)
 * Uses session storage to attribute conversions to previous clicks
 */
export async function trackOrderConversions(
  orderItems: Array<{ productId: string; price: number; quantity: number }>,
  clickedRecommendations: Array<{ sourceProductId: string; targetProductId: string; type: RecommendationType }>
): Promise<void> {
  for (const click of clickedRecommendations) {
    const item = orderItems.find(i => i.productId === click.targetProductId)
    if (item) {
      await trackConversion({
        sourceProductId: click.sourceProductId,
        targetProductId: click.targetProductId,
        type: click.type,
        revenue: item.price * item.quantity,
      })
    }
  }
}

// ===== ANALYTICS FUNCTIONS =====

/**
 * Get analytics for all recommendation types
 */
export async function getRecommendationAnalytics(): Promise<RecommendationAnalytics[]> {
  const results = await prisma.productRecommendation.groupBy({
    by: ['type'],
    _sum: {
      impressions: true,
      clicks: true,
      conversions: true,
      revenue: true,
    },
  })

  return results.map(result => {
    const impressions = result._sum.impressions || 0
    const clicks = result._sum.clicks || 0
    const conversions = result._sum.conversions || 0
    const revenue = result._sum.revenue || 0

    return {
      type: result.type,
      totalImpressions: impressions,
      totalClicks: clicks,
      totalConversions: conversions,
      totalRevenue: revenue,
      clickThroughRate: impressions > 0 ? (clicks / impressions) * 100 : 0,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    }
  })
}

/**
 * Get top performing recommendations
 */
export async function getTopRecommendations(limit: number = 10) {
  return prisma.productRecommendation.findMany({
    where: {
      clicks: { gt: 0 },
    },
    orderBy: [
      { conversions: 'desc' },
      { clicks: 'desc' },
    ],
    take: limit,
    include: {
      sourceProduct: {
        select: { id: true, name: true, slug: true },
      },
      targetProduct: {
        select: { id: true, name: true, slug: true, price: true },
      },
    },
  })
}

/**
 * Get recommendations with low performance (for optimization)
 */
export async function getLowPerformingRecommendations(impressionThreshold: number = 100) {
  return prisma.productRecommendation.findMany({
    where: {
      impressions: { gte: impressionThreshold },
      clicks: { equals: 0 },
    },
    orderBy: { impressions: 'desc' },
    take: 20,
    include: {
      sourceProduct: {
        select: { id: true, name: true },
      },
      targetProduct: {
        select: { id: true, name: true },
      },
    },
  })
}
