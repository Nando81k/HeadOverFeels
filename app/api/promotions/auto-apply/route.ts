import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema for auto-apply request
const AutoApplySchema = z.object({
  cartTotal: z.number().min(0),
  productIds: z.array(z.string()).optional(),
  customerEmail: z.string().email().optional(),
})

// POST /api/promotions/auto-apply - Find the best auto-apply promotion for the cart
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cartTotal, productIds, customerEmail } = AutoApplySchema.parse(body)
    
    const now = new Date()
    
    // Find all active auto-apply promotions
    const promotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        autoApply: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      orderBy: [
        { type: 'asc' }, // Prefer percentage/fixed over free_shipping
        { value: 'desc' }, // Prefer higher value
      ],
    })
    
    if (promotions.length === 0) {
      return NextResponse.json({
        promotion: null,
        message: 'No auto-apply promotions available',
      })
    }
    
    // Find the best applicable promotion
    let bestPromotion = null
    let bestDiscount = 0
    
    for (const promo of promotions) {
      // Check minimum purchase requirement
      if (promo.minimumPurchase && cartTotal < promo.minimumPurchase) {
        continue
      }
      
      // Check max uses
      if (promo.maxUsesTotal && promo.usedCount >= promo.maxUsesTotal) {
        continue
      }
      
      // Check product targeting (if specified)
      if (promo.productIds && productIds) {
        const targetedProducts: string[] = JSON.parse(promo.productIds)
        const hasMatchingProduct = productIds.some(id => targetedProducts.includes(id))
        if (!hasMatchingProduct) {
          continue
        }
      }
      
      // Check customer targeting (if specified)
      if (promo.customerEmails && customerEmail) {
        const targetedEmails: string[] = JSON.parse(promo.customerEmails)
        if (!targetedEmails.map(e => e.toLowerCase()).includes(customerEmail.toLowerCase())) {
          continue
        }
      }
      
      // Calculate potential discount
      let discount = 0
      if (promo.type === 'PERCENTAGE') {
        discount = cartTotal * (promo.value / 100)
      } else if (promo.type === 'FIXED_AMOUNT') {
        discount = Math.min(promo.value, cartTotal)
      } else if (promo.type === 'FREE_SHIPPING') {
        // Free shipping is valuable, assume ~10 for comparison
        discount = 10
      }
      
      // Check if this is better than current best
      if (discount > bestDiscount) {
        bestDiscount = discount
        bestPromotion = promo
      }
    }
    
    if (!bestPromotion) {
      return NextResponse.json({
        promotion: null,
        message: 'No applicable auto-apply promotions found',
      })
    }
    
    // Calculate actual discount value
    let discountAmount = 0
    let discountDescription = ''
    
    if (bestPromotion.type === 'PERCENTAGE') {
      discountAmount = bestPromotion.value
      discountDescription = `${bestPromotion.value}% off`
    } else if (bestPromotion.type === 'FIXED_AMOUNT') {
      discountAmount = bestPromotion.value
      discountDescription = `$${bestPromotion.value.toFixed(2)} off`
    } else if (bestPromotion.type === 'FREE_SHIPPING') {
      discountAmount = 0
      discountDescription = 'Free shipping'
    }
    
    return NextResponse.json({
      promotion: {
        id: bestPromotion.id,
        name: bestPromotion.name,
        code: bestPromotion.code || 'AUTO-APPLIED',
        type: bestPromotion.type.toLowerCase(),
        value: bestPromotion.value,
        discountAmount,
        discountDescription,
        freeShipping: bestPromotion.type === 'FREE_SHIPPING',
      },
    })
  } catch (error) {
    console.error('Auto-apply promotion error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to find auto-apply promotions' },
      { status: 500 }
    )
  }
}
