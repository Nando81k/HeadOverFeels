/**
 * Recommendation Tracking API
 * 
 * POST /api/recommendations/track - Track recommendation events (impressions, clicks, conversions)
 * GET /api/recommendations/track - Get recommendation analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { trackImpression, trackClick, trackBatchImpressions, getRecommendationAnalytics, getTopRecommendations } from '@/lib/recommendations/tracking'
import { RecommendationType } from '@prisma/client'
import { auth } from '@/lib/auth/auth'

// Valid event types
type EventType = 'impression' | 'click' | 'batch_impression'

interface TrackEventPayload {
  event: EventType
  sourceProductId: string
  targetProductId?: string       // Required for single events
  targetProductIds?: string[]    // Required for batch impressions
  type: RecommendationType
}

// POST: Track recommendation events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as TrackEventPayload

    const { event, sourceProductId, targetProductId, targetProductIds, type } = body

    // Validate required fields
    if (!event || !sourceProductId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: event, sourceProductId, type' },
        { status: 400 }
      )
    }

    // Validate recommendation type
    const validTypes: RecommendationType[] = [
      'SIMILAR',
      'FREQUENTLY_BOUGHT_TOGETHER',
      'COMPLEMENTARY',
      'ALSO_VIEWED',
      'TRENDING',
      'PERSONALIZED',
      'BEST_SELLERS',
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    switch (event) {
      case 'impression':
        if (!targetProductId) {
          return NextResponse.json(
            { error: 'targetProductId required for impression event' },
            { status: 400 }
          )
        }
        await trackImpression({ sourceProductId, targetProductId, type })
        break

      case 'click':
        if (!targetProductId) {
          return NextResponse.json(
            { error: 'targetProductId required for click event' },
            { status: 400 }
          )
        }
        await trackClick({ sourceProductId, targetProductId, type })
        break

      case 'batch_impression':
        if (!targetProductIds || !Array.isArray(targetProductIds)) {
          return NextResponse.json(
            { error: 'targetProductIds array required for batch_impression event' },
            { status: 400 }
          )
        }
        await trackBatchImpressions(sourceProductId, targetProductIds, type)
        break

      default:
        return NextResponse.json(
          { error: `Invalid event type. Must be: impression, click, or batch_impression` },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Recommendation tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to track recommendation event' },
      { status: 500 }
    )
  }
}

// GET: Get recommendation analytics (admin only)
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [analytics, topRecommendations] = await Promise.all([
      getRecommendationAnalytics(),
      getTopRecommendations(10),
    ])

    return NextResponse.json({
      data: {
        analytics,
        topRecommendations,
      },
    })
  } catch (error) {
    console.error('Failed to get recommendation analytics:', error)
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    )
  }
}
