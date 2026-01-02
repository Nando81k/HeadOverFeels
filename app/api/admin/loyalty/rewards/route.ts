import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RewardType, Prisma } from '@prisma/client'
import { verifyAdmin } from '@/lib/auth/admin'

// GET /api/admin/loyalty/rewards - Get all rewards (including inactive)
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const isActive = searchParams.get('isActive')

    const where: Prisma.RewardWhereInput = {}
    
    if (category && category !== 'all') {
      where.rewardType = category as RewardType
    }
    
    if (isActive !== null && isActive !== 'all') {
      where.isActive = isActive === 'true'
    }

    const rewards = await prisma.reward.findMany({
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
    })

    return NextResponse.json(rewards)
  } catch (error) {
    console.error('Error fetching rewards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rewards' },
      { status: 500 }
    )
  }
}

// POST /api/admin/loyalty/rewards - Create new reward
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    const {
      name,
      slug,
      description,
      pointsCost,
      rewardType,
      value,
      isActive,
      minTierRequired,
      maxRedemptionsPerCustomer,
      totalAvailable,
      image,
      metadata,
      sortOrder,
    } = body

    // Validate required fields
    if (!name || !slug || !pointsCost || !rewardType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existing = await prisma.reward.findUnique({
      where: { slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Reward with this slug already exists' },
        { status: 400 }
      )
    }

    // Create reward
    const reward = await prisma.reward.create({
      data: {
        name,
        slug,
        description,
        pointsCost,
        rewardType,
        value: value || null,
        isActive: isActive ?? true,
        minTierRequired: minTierRequired || null,
        maxRedemptionsPerCustomer: maxRedemptionsPerCustomer || null,
        totalAvailable: totalAvailable || null,
        image: image || null,
        metadata: metadata || null,
        sortOrder: sortOrder || 0,
      },
      include: {
        _count: {
          select: {
            redemptions: true,
          },
        },
      },
    })

    return NextResponse.json(reward, { status: 201 })
  } catch (error) {
    console.error('Error creating reward:', error)
    return NextResponse.json(
      { error: 'Failed to create reward' },
      { status: 500 }
    )
  }
}
