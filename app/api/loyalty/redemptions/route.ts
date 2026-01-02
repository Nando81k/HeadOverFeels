import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPaginationParams, createPaginatedResponse } from '@/lib/validation/schemas'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from session cookie
    const userId = request.cookies.get('auth_session')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate pagination parameters
    const { page, limit } = getPaginationParams(new URL(request.url).searchParams)
    const skip = (page - 1) * limit

    const [redemptions, total] = await Promise.all([
      prisma.rewardRedemption.findMany({
        where: {
          customerId: userId,
        },
        include: {
          reward: {
            select: {
              name: true,
              rewardType: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.rewardRedemption.count({
        where: {
          customerId: userId,
        },
      }),
    ])

    const mappedRedemptions = redemptions.map((redemption) => ({
      id: redemption.id,
      rewardName: redemption.reward.name,
      rewardType: redemption.reward.rewardType,
      pointsSpent: redemption.pointsSpent,
      status: redemption.status,
      couponCode: redemption.couponCode,
      usedAt: redemption.usedAt?.toISOString() || null,
      createdAt: redemption.createdAt.toISOString(),
    }))

    return NextResponse.json(
      createPaginatedResponse(mappedRedemptions, total, page, limit)
    )
  } catch (error) {
    console.error('Failed to fetch redemptions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch redemptions' },
      { status: 500 }
    )
  }
}
