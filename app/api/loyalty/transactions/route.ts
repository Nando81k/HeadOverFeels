import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPaginationParams, createPaginatedResponse } from '@/lib/validation/schemas'

// GET /api/loyalty/transactions - Get customer's points transaction history
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('auth_session')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const { page, limit } = getPaginationParams(searchParams)
    const skip = (page - 1) * limit
    
    // Optional filters
    const type = searchParams.get('type') // PURCHASE, REDEMPTION, REFERRAL, etc.
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    const where: Record<string, unknown> = {
      customerId: userId,
    }

    if (type) {
      where.type = type
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate)
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(endDate)
      }
    }

    const [transactions, total, summary] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
            },
          },
          redemption: {
            select: {
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
      // Summary stats
      prisma.pointsTransaction.groupBy({
        by: ['type'],
        where: { customerId: userId },
        _sum: {
          points: true,
        },
        _count: true,
      }),
    ])

    // Calculate totals
    const totalEarned = summary
      .filter(s => (s._sum.points || 0) > 0)
      .reduce((acc, s) => acc + (s._sum.points || 0), 0)
    
    const totalSpent = Math.abs(
      summary
        .filter(s => (s._sum.points || 0) < 0)
        .reduce((acc, s) => acc + (s._sum.points || 0), 0)
    )

    const mappedTransactions = transactions.map((tx) => ({
      id: tx.id,
      points: tx.points,
      type: tx.type,
      description: tx.description,
      orderNumber: tx.order?.orderNumber || null,
      rewardName: tx.redemption?.reward?.name || null,
      expiresAt: tx.expiresAt?.toISOString() || null,
      isExpired: tx.isExpired,
      createdAt: tx.createdAt.toISOString(),
    }))

    return NextResponse.json({
      ...createPaginatedResponse(mappedTransactions, total, page, limit),
      summary: {
        totalEarned,
        totalSpent,
        byType: summary.map(s => ({
          type: s.type,
          total: s._sum.points || 0,
          count: s._count,
        })),
      },
    })
  } catch (error) {
    console.error('Failed to fetch transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
