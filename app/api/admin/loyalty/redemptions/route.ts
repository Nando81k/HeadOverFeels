import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'
import { Prisma } from '@prisma/client'

// GET /api/admin/loyalty/redemptions
export async function GET(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)))
    const status = searchParams.get('status') // PENDING | USED | FULFILLED | CANCELLED | EXPIRED
    const rewardType = searchParams.get('rewardType')
    const search = searchParams.get('search')?.trim()
    const needsFulfillment = searchParams.get('needsFulfillment') === 'true'

    const where: Prisma.RewardRedemptionWhereInput = {}

    if (status) {
      where.status = status as Prisma.EnumRedemptionStatusFilter
    }

    if (needsFulfillment) {
      // Physical/digital/charity/exclusive rewards that are still PENDING
      where.status = 'PENDING'
      where.reward = {
        rewardType: {
          in: ['PHYSICAL_PERK', 'DIGITAL_CONTENT', 'CHARITY_DONATION', 'EXCLUSIVE_PRODUCT'],
        },
      }
    } else if (rewardType) {
      where.reward = { rewardType: rewardType as Prisma.EnumRewardTypeFilter }
    }

    if (search) {
      where.customer = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    const [redemptions, total] = await Promise.all([
      prisma.rewardRedemption.findMany({
        where,
        include: {
          customer: { select: { id: true, email: true, name: true } },
          reward: { select: { id: true, name: true, rewardType: true, value: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.rewardRedemption.count({ where }),
    ])

    return NextResponse.json({
      items: redemptions.map((r) => ({
        id: r.id,
        status: r.status,
        pointsSpent: r.pointsSpent,
        couponCode: r.couponCode,
        trackingNumber: r.trackingNumber,
        shippedAt: r.shippedAt?.toISOString() ?? null,
        usedAt: r.usedAt?.toISOString() ?? null,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        customer: r.customer,
        reward: r.reward,
      })),
      total,
      page,
      pageCount: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('GET /api/admin/loyalty/redemptions failed:', error)
    return NextResponse.json({ error: 'Failed to fetch redemptions' }, { status: 500 })
  }
}
