import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from session cookie
    const sessionId = request.cookies.get('auth_session')?.value

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch customer with tier information
    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
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

    // Calculate annual spend (last 365 days)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    let annualSpend = 0
    try {
      const annualOrders = await prisma.order.aggregate({
        where: {
          customerId: sessionId,
          createdAt: {
            gte: oneYearAgo,
          },
          status: 'DELIVERED',
        },
        _sum: {
          total: true,
        },
      })
      annualSpend = Number(annualOrders._sum?.total || 0)
    } catch (orderError) {
      console.error('Error calculating annual spend:', orderError)
      // Continue with 0 annual spend if orders query fails
    }

    // Find next tier
    const allTiers = await prisma.loyaltyTier.findMany({
      where: { isActive: true },
      orderBy: { minAnnualSpend: 'asc' },
    })

    const nextTier = allTiers.find(
      (tier) => Number(tier.minAnnualSpend) > annualSpend
    ) || null

    // Fetch recent points activity (last 10 transactions)
    let recentActivity: Array<{
      id: string
      points: number
      type: string
      description: string
      createdAt: Date
    }> = []
    try {
      recentActivity = await prisma.pointsTransaction.findMany({
        where: { customerId: sessionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          points: true,
          type: true,
          description: true,
          createdAt: true,
        },
      })
    } catch (activityError) {
      console.error('Error fetching points activity:', activityError)
      // Continue with empty activity if query fails
    }

    // Count available rewards for user's tier
    const availableRewardsCount = await prisma.reward.count({
      where: {
        isActive: true,
        OR: [
          { minTierRequired: null },
          {
            minTierRequired: customer.loyaltyTier?.slug,
          },
        ],
      },
    })

    return NextResponse.json({
      currentTier: customer.loyaltyTier,
      nextTier,
      points: customer.currentPoints,
      annualSpend: annualSpend,
      recentActivity: recentActivity.map((activity) => ({
        id: activity.id,
        description: activity.description,
        points: activity.points,
        createdAt: activity.createdAt.toISOString(),
        type: activity.points > 0 ? 'earned' : 'spent',
      })),
      availableRewardsCount,
    })
  } catch (error) {
    console.error('Failed to fetch loyalty data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch loyalty data' },
      { status: 500 }
    )
  }
}
