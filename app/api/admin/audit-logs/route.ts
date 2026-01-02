import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'
import { getPaginationParams, createPaginatedResponse } from '@/lib/validation/schemas'
import { z } from 'zod'

// Validation schema for audit log queries
const AuditLogQuerySchema = z.object({
  customerId: z.string().optional(),
  type: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minPoints: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
  maxPoints: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
})

/**
 * GET /api/admin/audit-logs
 * List all points transactions with admin filtering and pagination
 * Requires admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get pagination parameters from URL
    const { page, limit } = getPaginationParams(
      new URL(request.url).searchParams
    )
    const skip = (page - 1) * limit

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId') || undefined
    const type = searchParams.get('type') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const minPoints = searchParams.get('minPoints') || undefined
    const maxPoints = searchParams.get('maxPoints') || undefined

    // Validate filters
    try {
      AuditLogQuerySchema.parse({
        customerId,
        type,
        startDate,
        endDate,
        minPoints,
        maxPoints,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid filter parameters', details: error.issues },
          { status: 400 }
        )
      }
      throw error
    }

    // Build where clause
    const where: any = {}

    if (customerId) {
      where.customerId = customerId
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

    // Points range filter
    if (minPoints !== undefined || maxPoints !== undefined) {
      where.points = {}
      if (minPoints !== undefined) {
        where.points.gte = parseInt(minPoints)
      }
      if (maxPoints !== undefined) {
        where.points.lte = parseInt(maxPoints)
      }
    }

    // Fetch transactions with relations
    const [transactions, total] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              currentPoints: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
            },
          },
          review: {
            select: {
              id: true,
              rating: true,
              title: true,
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
      customerId: transaction.customerId,
      customerEmail: transaction.customer.email,
      customerPoints: transaction.customer.currentPoints,
      points: transaction.points,
      type: transaction.type,
      description: transaction.description,
      reference: {
        orderId: transaction.orderId,
        orderNumber: transaction.order?.orderNumber,
        reviewId: transaction.reviewId,
        reviewTitle: transaction.review?.title,
        redemptionId: transaction.redemptionId,
        rewardName: transaction.redemption?.reward.name,
      },
      expiresAt: transaction.expiresAt?.toISOString() || null,
      isExpired: transaction.isExpired,
      createdAt: transaction.createdAt.toISOString(),
    }))

    return NextResponse.json(
      createPaginatedResponse(formattedTransactions, total, page, limit)
    )
  } catch (error) {
    console.error('Audit logs fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
