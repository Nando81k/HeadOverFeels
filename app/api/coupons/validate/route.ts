import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ValidateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required').max(50, 'Coupon code too long'),
  subtotal: z.number().positive('Subtotal must be positive').optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, subtotal } = ValidateCouponSchema.parse(body)

    // Find redemption with this coupon code
    const redemption = await prisma.rewardRedemption.findUnique({
      where: { couponCode: code.toUpperCase() },
      include: {
        reward: true,
        customer: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    if (!redemption) {
      return NextResponse.json(
        { error: 'Invalid coupon code', valid: false },
        { status: 404 }
      )
    }

    // Check if already used
    if (redemption.usedAt) {
      return NextResponse.json(
        { error: 'This coupon has already been used', valid: false },
        { status: 400 }
      )
    }

    // Check if expired (redemptions older than 90 days are expired)
    const expirationDate = new Date(redemption.createdAt)
    expirationDate.setDate(expirationDate.getDate() + 90)
    if (new Date() > expirationDate) {
      return NextResponse.json(
        { error: 'This coupon has expired', valid: false },
        { status: 400 }
      )
    }

    // Check if reward is still active
    if (!redemption.reward.isActive) {
      return NextResponse.json(
        { error: 'This reward is no longer available', valid: false },
        { status: 400 }
      )
    }

    // Calculate discount based on reward type
    let discountAmount = 0
    let discountType: 'fixed' | 'percentage' | 'free_shipping' | 'perk' = 'fixed'
    let description = redemption.reward.name

    switch (redemption.reward.rewardType) {
      case 'DISCOUNT':
        // Fixed dollar amount discount
        discountAmount = redemption.reward.value || 0
        discountType = 'fixed'
        description = `$${discountAmount} off`
        break

      case 'FREE_SHIPPING':
        discountType = 'free_shipping'
        discountAmount = 0 // Will be calculated based on shipping cost
        description = 'Free shipping'
        break

      case 'EARLY_ACCESS':
      case 'EXCLUSIVE_PRODUCT':
      case 'CHARITY_DONATION':
      case 'DIGITAL_CONTENT':
      case 'PHYSICAL_PERK':
        discountType = 'perk'
        description = redemption.reward.name
        break

      default:
        discountType = 'fixed'
        discountAmount = redemption.reward.value || 0
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        code: redemption.couponCode,
        redemptionId: redemption.id,
        customerId: redemption.customerId,
        reward: {
          id: redemption.reward.id,
          name: redemption.reward.name,
          type: redemption.reward.rewardType,
          value: redemption.reward.value,
        },
        discountType,
        discountAmount,
        description,
        expiresAt: expirationDate.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues, valid: false },
        { status: 400 }
      )
    }

    console.error('Coupon validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate coupon', valid: false },
      { status: 500 }
    )
  }
}
