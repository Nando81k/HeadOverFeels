import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { checkPromoOverlap } from '@/lib/promotions/validation'
import type { PromotionType } from '@prisma/client'

interface CheckOverlapRequest {
  promoId?: string | null
  startDate: string
  endDate?: string | null
  type: PromotionType
  productIds?: string[]
  collectionIds?: string[]
}

// POST /api/admin/promotions/check-overlap - Check for overlapping promotions
export async function POST(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CheckOverlapRequest = await request.json()
    const { promoId, startDate, endDate, type, productIds, collectionIds } = body

    if (!startDate || !type) {
      return NextResponse.json(
        { error: 'startDate and type are required' },
        { status: 400 }
      )
    }

    const result = await checkPromoOverlap(
      promoId || null,
      new Date(startDate),
      endDate ? new Date(endDate) : null,
      type,
      productIds,
      collectionIds
    )

    return NextResponse.json({
      hasOverlap: result.hasOverlap,
      overlappingPromos: result.overlappingPromos,
      message: result.hasOverlap 
        ? `Warning: This promotion overlaps with ${result.overlappingPromos.length} existing non-stackable promotion(s)`
        : 'No conflicts detected',
    })
  } catch (error) {
    console.error('Error checking promo overlap:', error)
    return NextResponse.json(
      { error: 'Failed to check promotion overlap' },
      { status: 500 }
    )
  }
}
