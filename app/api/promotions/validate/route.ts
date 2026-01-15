import { NextRequest, NextResponse } from 'next/server'
import { validatePromotion, calculateStackedDiscount, type AppliedPromotion } from '@/lib/promotions/validation'

interface ValidateRequest {
  code: string
  cartTotal: number
  productIds?: string[]
  collectionIds?: string[]
  customerEmail?: string
  customerId?: string
  currentPromotions?: AppliedPromotion[]
}

// POST /api/promotions/validate - Validate a promotion code with stacking rules
export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json()
    const { code, cartTotal, productIds, collectionIds, customerEmail, customerId, currentPromotions } = body
    
    // Use the new validation service
    const result = await validatePromotion({
      code,
      cartTotal,
      productIds,
      collectionIds,
      customerEmail,
      customerId,
      currentPromotions,
    })

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        error: result.error,
      })
    }

    // Calculate stacked discount if there are current promotions
    let stackInfo = null
    if (currentPromotions && currentPromotions.length > 0 && result.promotion) {
      const allPromos = [...currentPromotions, {
        id: result.promotion.id,
        code: result.promotion.code,
        type: result.promotion.type,
        value: result.promotion.value,
        discount: result.promotion.discount,
        stackable: result.promotion.stackable,
        excludeFromLoyalty: result.promotion.excludeFromLoyalty,
      }]
      
      stackInfo = calculateStackedDiscount(allPromos, cartTotal)
    }

    return NextResponse.json({
      valid: true,
      promotion: result.promotion,
      warnings: result.warnings,
      stackInfo,
    })
  } catch (error) {
    console.error('Error validating promotion:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to validate promotion' },
      { status: 500 }
    )
  }
}
