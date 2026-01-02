import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, RewardType } from '@prisma/client'
import { getPaginationParams, createPaginatedResponse } from '@/lib/validation/schemas'

// GET /api/loyalty/rewards - Get all active rewards
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') // Filter by rewardType
    const sessionId = request.cookies.get('auth_session')?.value

    // Validate pagination parameters
    const { page, limit } = getPaginationParams(new URL(request.url).searchParams)
    const skip = (page - 1) * limit

    // Get customer data if logged in
    let customer = null
    if (sessionId) {
      customer = await prisma.customer.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          currentPoints: true,
          loyaltyTier: {
            select: {
              slug: true,
            },
          },
        },
      })
    }

    // Build where clause
    const where: Prisma.RewardWhereInput = {
      isActive: true,
    }

    // Filter by category (rewardType)
    if (category && category !== 'all') {
      where.rewardType = category as RewardType
    }

    // Fetch rewards with pagination
    const [rewards, total] = await Promise.all([
      prisma.reward.findMany({
        where,
        orderBy: {
          sortOrder: 'asc',
        },
        include: {
          _count: {
            select: {
              redemptions: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.reward.count({ where }),
    ])

    // Add customer-specific data to each reward
    const rewardsWithCustomerData = rewards.map((reward) => {
      const canAfford = customer ? customer.currentPoints >= reward.pointsCost : false
      
      // Check tier requirement
      const meetsTierRequirement = !reward.minTierRequired || 
        (customer?.loyaltyTier && isEligibleForTier(customer.loyaltyTier.slug, reward.minTierRequired))
      
      // Check max redemptions
      let isMaxedOut = false
      if (reward.maxRedemptionsPerCustomer) {
        // This will be checked more precisely in the redemption endpoint
        isMaxedOut = false // Placeholder - would need to query redemptions table
      }

      return {
        ...reward,
        canAfford,
        meetsTierRequirement,
        isMaxedOut,
        isAvailable: meetsTierRequirement && !isMaxedOut && 
          (!reward.totalAvailable || reward.totalRedeemed < reward.totalAvailable),
      }
    })

    return NextResponse.json({
      ...createPaginatedResponse(rewardsWithCustomerData, total, page, limit),
      customerPoints: customer?.currentPoints || 0,
    })
  } catch (error) {
    console.error('Get rewards error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rewards' },
      { status: 500 }
    )
  }
}

// Helper function to check tier eligibility
function isEligibleForTier(customerTierSlug: string, requiredTierSlug: string): boolean {
  const tierHierarchy = ['head', 'heart', 'mind', 'overdrive']
  const customerTierIndex = tierHierarchy.indexOf(customerTierSlug)
  const requiredTierIndex = tierHierarchy.indexOf(requiredTierSlug)
  
  return customerTierIndex >= requiredTierIndex
}
