import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { Prisma } from '@prisma/client'

const RedeemSchema = z.object({
  rewardId: z.string().cuid('Invalid reward ID').max(255, 'Reward ID too long'),
  idempotencyKey: z.string().uuid('Invalid idempotency key').optional(), // Client-provided or auto-generated
})

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from session cookie
    const userId = request.cookies.get('auth_session')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = RedeemSchema.parse(body)
    
    // Generate or use provided idempotency key
    const idempotencyKey = validatedData.idempotencyKey || uuidv4()

    const { rewardId } = validatedData

    // Fetch reward
    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
    })

    if (!reward || !reward.isActive) {
      return NextResponse.json(
        { error: 'Reward not found or inactive' },
        { status: 404 }
      )
    }

    // Fetch customer with tier
    const customer = await prisma.customer.findUnique({
      where: { id: userId },
      include: {
        loyaltyTier: true,
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Check if customer has enough points
    if (customer.currentPoints < reward.pointsCost) {
      return NextResponse.json(
        { error: 'Insufficient points', required: reward.pointsCost, available: customer.currentPoints },
        { status: 400 }
      )
    }

    // Check tier requirement
    if (reward.minTierRequired && customer.loyaltyTier) {
      const tierHierarchy = ['bronze', 'silver', 'gold', 'platinum']
      const requiredTierIndex = tierHierarchy.indexOf(reward.minTierRequired)
      const customerTierIndex = tierHierarchy.indexOf(customer.loyaltyTier.slug)

      if (customerTierIndex < requiredTierIndex) {
        return NextResponse.json(
          { error: 'Tier requirement not met', requiredTier: reward.minTierRequired },
          { status: 403 }
        )
      }
    }

    // Check stock availability
    if (reward.totalAvailable !== null && reward.totalAvailable !== undefined) {
      const remaining = reward.totalAvailable - reward.totalRedeemed
      if (remaining <= 0) {
        return NextResponse.json(
          { error: 'Reward out of stock' },
          { status: 400 }
        )
      }
    }

    // Check per-customer limit
    if (reward.maxRedemptionsPerCustomer !== null && reward.maxRedemptionsPerCustomer !== undefined) {
      const customerRedemptions = await prisma.rewardRedemption.count({
        where: {
          customerId: userId,
          rewardId: rewardId,
          status: { not: 'CANCELLED' },
        },
      })

      if (customerRedemptions >= reward.maxRedemptionsPerCustomer) {
        return NextResponse.json(
          { error: 'Maximum redemptions per customer reached', limit: reward.maxRedemptionsPerCustomer },
          { status: 400 }
        )
      }
    }

    // Create redemption and update points in a transaction with idempotency
    // CRITICAL: Use idempotencyKey to prevent race conditions
    const redemption = await prisma.$transaction(
      async (tx) => {
        // Check if this redemption already exists (idempotency check)
        // If the client retries the same request, we return the existing redemption
        const existingRedemption = await tx.rewardRedemption.findUnique({
          where: { idempotencyKey: idempotencyKey },
        })

        if (existingRedemption) {
          // Return existing redemption (client retry - prevent duplicate)
          return existingRedemption
        }

        // Re-check points availability one more time inside transaction
        // to prevent race condition where concurrent requests reduce points
        const currentCustomer = await tx.customer.findUnique({
          where: { id: userId },
        })

        if (!currentCustomer || currentCustomer.currentPoints < reward.pointsCost) {
          throw new Error('INSUFFICIENT_POINTS')
        }

        // Generate coupon code for discount-type rewards
        let couponCode: string | null = null
        if (['DISCOUNT', 'FREE_SHIPPING'].includes(reward.rewardType)) {
          // Generate a unique coupon code: HOF-{TYPE}-{RANDOM}
          const prefix = reward.rewardType === 'DISCOUNT' ? 'DISC' : 'SHIP'
          const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
          couponCode = `HOF-${prefix}-${randomPart}`
        }

        // Create redemption record with idempotency key
        const newRedemption = await tx.rewardRedemption.create({
          data: {
            customerId: userId,
            rewardId: rewardId,
            pointsSpent: reward.pointsCost,
            status: couponCode ? 'PENDING' : 'FULFILLED', // Discount coupons are pending until used
            idempotencyKey: idempotencyKey,
            couponCode: couponCode,
          },
        })

        // Deduct points from customer
        await tx.customer.update({
          where: { id: userId },
          data: {
            currentPoints: {
              decrement: reward.pointsCost,
            },
          },
        })

        // Create points transaction record
        await tx.pointsTransaction.create({
          data: {
            customerId: userId,
            points: -reward.pointsCost,
            type: 'REDEMPTION',
            description: `Redeemed: ${reward.name}`,
            redemptionId: newRedemption.id,
          },
        })

        // Update reward redeemed count
        await tx.reward.update({
          where: { id: rewardId },
          data: {
            totalRedeemed: {
              increment: 1,
            },
          },
        })

        return newRedemption
      },
      {
        // Ensure serializable isolation level to prevent race conditions
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    return NextResponse.json({
      success: true,
      redemption: {
        id: redemption.id,
        pointsSpent: redemption.pointsSpent,
        status: redemption.status,
        couponCode: redemption.couponCode,
        createdAt: redemption.createdAt,
      },
      reward: {
        name: reward.name,
        type: reward.rewardType,
        value: reward.value,
      },
      newPointsBalance: customer.currentPoints - reward.pointsCost,
      idempotencyKey: idempotencyKey,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'INSUFFICIENT_POINTS') {
      return NextResponse.json(
        { error: 'Insufficient points available (race condition prevented)' },
        { status: 400 }
      )
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle unique constraint violation (duplicate idempotency key)
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Redemption already processed (duplicate request detected)' },
          { status: 409 }
        )
      }
    }

    console.error('Failed to redeem reward:', error)
    return NextResponse.json(
      { error: 'Failed to redeem reward' },
      { status: 500 }
    )
  }
}
