import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { createPaginatedResponse, getPaginationParams } from '@/lib/validation/schemas'

// GET /api/admin/loyalty/customers - List customers with loyalty info
export async function GET(request: NextRequest) {
  try {
    // Check admin auth
    const adminId = request.cookies.get('admin_session')?.value
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, limit, page } = getPaginationParams(searchParams)
    
    const search = searchParams.get('search') || ''
    const tierId = searchParams.get('tier') || ''
    const sortBy = searchParams.get('sortBy') || 'currentPoints'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    // Build where clause - exclude admin accounts from customer list
    const where: Record<string, unknown> = {
      isAdmin: { not: true }
    }
    
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ]
    }

    if (tierId) {
      where.tierId = tierId
    }

    // Get customers with loyalty data
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          loyaltyTier: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              orders: true,
              pointsTransactions: true,
              redemptions: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ])

    // Get all tiers for filtering
    const tiers = await prisma.loyaltyTier.findMany({
      select: { id: true, name: true },
      orderBy: { minAnnualPoints: 'asc' },
    })

    const formattedCustomers = customers.map(customer => ({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      currentPoints: customer.currentPoints,
      lifetimePoints: customer.lifetimePoints,
      annualPointsEarned: customer.annualPointsEarned,
      totalSpent: customer.totalSpent,
      tier: customer.loyaltyTier ? {
        id: customer.loyaltyTier.id,
        name: customer.loyaltyTier.name,
      } : null,
      orderCount: customer._count.orders,
      transactionCount: customer._count.pointsTransactions,
      redemptionCount: customer._count.redemptions,
      createdAt: customer.createdAt.toISOString(),
    }))

    return NextResponse.json({
      ...createPaginatedResponse(formattedCustomers, total, page, limit),
      tiers,
    })
  } catch (error) {
    console.error('Failed to fetch customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

// POST /api/admin/loyalty/customers - Adjust customer points or tier
const AdjustCustomerSchema = z.object({
  customerId: z.string(),
  action: z.enum(['adjustPoints', 'changeTier']),
  points: z.number().optional(),
  reason: z.string().optional(),
  tierId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const adminId = request.cookies.get('admin_session')?.value
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customerId, action, points, reason, tierId } = AdjustCustomerSchema.parse(body)

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { loyaltyTier: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (action === 'adjustPoints') {
      if (points === undefined) {
        return NextResponse.json({ error: 'Points amount required' }, { status: 400 })
      }

      // Create points transaction
      await prisma.$transaction(async (tx) => {
        await tx.pointsTransaction.create({
          data: {
            customerId,
            points,
            type: 'ADMIN_ADJUSTMENT',
            description: reason || `Manual adjustment by admin`,
          },
        })

        const updateData: Record<string, unknown> = {
          currentPoints: { increment: points },
        }

        // Only update lifetime and annual points if adding points
        if (points > 0) {
          updateData.lifetimePoints = { increment: points }
          updateData.annualPointsEarned = { increment: points }
        }

        await tx.customer.update({
          where: { id: customerId },
          data: updateData,
        })
      })

      const updatedCustomer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { currentPoints: true, lifetimePoints: true },
      })

      return NextResponse.json({
        success: true,
        message: `${points >= 0 ? 'Added' : 'Removed'} ${Math.abs(points)} points`,
        newBalance: updatedCustomer?.currentPoints || 0,
      })
    }

    if (action === 'changeTier') {
      if (!tierId) {
        return NextResponse.json({ error: 'Tier ID required' }, { status: 400 })
      }

      const tier = await prisma.loyaltyTier.findUnique({
        where: { id: tierId },
      })

      if (!tier) {
        return NextResponse.json({ error: 'Tier not found' }, { status: 404 })
      }

      await prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyTierId: tierId },
      })

      return NextResponse.json({
        success: true,
        message: `Changed tier to ${tier.name}`,
        newTier: tier.name,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Failed to adjust customer:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
