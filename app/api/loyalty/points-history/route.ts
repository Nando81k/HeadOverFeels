import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPaginationParams, createPaginatedResponse } from '@/lib/validation/schemas'

/**
 * GET /api/loyalty/points-history
 * Get authenticated customer's points transaction history with pagination
 * Requires auth_session cookie
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from session cookie
    const customerId = request.cookies.get('auth_session')?.value

    if (!customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate pagination parameters
    const { page, limit } = getPaginationParams(
      new URL(request.url).searchParams
    )
    const skip = (page - 1) * limit

    // Get query filters
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    // Build where clause
    const where: any = {
      customerId,
    }

    if (type) {
      where.type = type
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // Fetch transactions with relations
    const [transactions, total] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where,
        select: {
          id: true,
          points: true,
          type: true,
          description: true,
          createdAt: true,
          expiresAt: true,
          isExpired: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          review: {
            select: {
              id: true,
              title: true,
              rating: true,
            },
          },
          redemption: {
            select: {
              id: true,
              reward: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.pointsTransaction.count({ where }),
    ])

    // Format response
    const formattedTransactions = transactions.map((transaction) => ({
      id: transaction.id,
      points: transaction.points,
      type: transaction.type,
      description: transaction.description,
      isExpired: transaction.isExpired,
      expiresAt: transaction.expiresAt?.toISOString() || null,
      createdAt: transaction.createdAt.toISOString(),
      reference: {
        orderId: transaction.order?.id,
        orderNumber: transaction.order?.orderNumber,
        reviewId: transaction.review?.id,
        reviewTitle: transaction.review?.title,
        redemptionId: transaction.redemption?.id,
        rewardName: transaction.redemption?.reward.name,
      },
    }))

    return NextResponse.json(
      createPaginatedResponse(formattedTransactions, total, page, limit)
    )
  } catch (error) {
    console.error('Points history fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch points history' },
      { status: 500 }
    )
  }
}
