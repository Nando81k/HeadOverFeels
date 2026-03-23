import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveMultiplierEvent } from '@/lib/loyalty/service'
import { auth } from '@/lib/auth/auth'

const CANONICAL_CUSTOMER_ORDER = [
  { totalOrders: 'desc' as const },
  { lifetimePoints: 'desc' as const },
  { currentPoints: 'desc' as const },
  { createdAt: 'asc' as const },
]

async function findCustomerWithTierById(customerId: string) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      loyaltyTier: true,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    // Resolve authenticated customer from either NextAuth session or legacy cookie session
    const session = await auth()
    const authSessionCookie = request.cookies.get('auth_session')?.value
    const sessionId = session?.user?.id || authSessionCookie

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const baseCustomer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        email: true,
      },
    })

    const referenceEmail =
      session?.user?.email?.toLowerCase().trim() ||
      baseCustomer?.email.toLowerCase().trim() ||
      null

    let customer = null as Awaited<ReturnType<typeof findCustomerWithTierById>>
    if (referenceEmail) {
      customer = await prisma.customer.findFirst({
        where: {
          email: {
            equals: referenceEmail,
            mode: 'insensitive',
          },
        },
        orderBy: CANONICAL_CUSTOMER_ORDER,
        include: {
          loyaltyTier: true,
        },
      })
    }

    if (!customer) {
      customer = await findCustomerWithTierById(sessionId)
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const resolvedCustomerId = customer.id

    // Fetch active multiplier event
    const activeEvent = await getActiveMultiplierEvent(resolvedCustomerId)

    // Calculate annual spend (last 365 days)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    let annualSpend = 0
    try {
      const annualOrders = await prisma.order.aggregate({
        where: {
          customerId: resolvedCustomerId,
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

    // Find next tier based on annual points earned (matches loyalty upgrade logic)
    const allTiers = await prisma.loyaltyTier.findMany({
      where: { isActive: true, isInviteOnly: false },
      orderBy: { minAnnualPoints: 'asc' },
    })

    const nextTier = allTiers.find(
      (tier) => tier.minAnnualPoints > customer.annualPointsEarned
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
        where: { customerId: resolvedCustomerId },
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

    const response = NextResponse.json({
      currentTier: customer.loyaltyTier,
      tierName: customer.loyaltyTier?.name || 'Friend',
      tierSlug: customer.loyaltyTier?.slug || 'friend',
      pointMultiplier: customer.loyaltyTier?.pointMultiplier || 1,
      annualPointsEarned: customer.annualPointsEarned,
      nextTier: nextTier ? {
        name: nextTier.name,
        slug: nextTier.slug,
        minAnnualPoints: nextTier.minAnnualPoints,
        pointsNeeded: Math.max(0, nextTier.minAnnualPoints - customer.annualPointsEarned),
      } : null,
      tiers: allTiers.map((tier) => ({
        name: tier.name,
        slug: tier.slug,
        minAnnualPoints: tier.minAnnualPoints,
        pointMultiplier: tier.pointMultiplier,
        primaryColor: tier.primaryColor,
        secondaryColor: tier.secondaryColor,
      })),
      activeEvent: activeEvent ? {
        name: activeEvent.eventName,
        multiplier: activeEvent.multiplier,
      } : null,
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

    if (authSessionCookie !== resolvedCustomerId) {
      response.cookies.set('auth_session', resolvedCustomerId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

    return response
  } catch (error) {
    console.error('Failed to fetch loyalty data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch loyalty data' },
      { status: 500 }
    )
  }
}
