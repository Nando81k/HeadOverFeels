import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET /api/admin/loyalty/rewards/[id] - Get single reward
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const { id } = await params

    const reward = await prisma.reward.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            redemptions: true,
          },
        },
      },
    })

    if (!reward) {
      return NextResponse.json(
        { error: 'Reward not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(reward)
  } catch (error) {
    console.error('Error fetching reward:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reward' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/loyalty/rewards/[id] - Update reward
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    
    // Check if reward exists
    const existing = await prisma.reward.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Reward not found' },
        { status: 404 }
      )
    }

    // If slug is being changed, check it's not already taken
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await prisma.reward.findUnique({
        where: { slug: body.slug },
      })

      if (slugExists) {
        return NextResponse.json(
          { error: 'Reward with this slug already exists' },
          { status: 400 }
        )
      }
    }

    // Update reward
    const reward = await prisma.reward.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        pointsCost: body.pointsCost,
        rewardType: body.rewardType,
        value: body.value ?? null,
        isActive: body.isActive,
        minTierRequired: body.minTierRequired ?? null,
        maxRedemptionsPerCustomer: body.maxRedemptionsPerCustomer ?? null,
        totalAvailable: body.totalAvailable ?? null,
        image: body.image ?? null,
        metadata: body.metadata ?? null,
        sortOrder: body.sortOrder,
      },
      include: {
        _count: {
          select: {
            redemptions: true,
          },
        },
      },
    })

    return NextResponse.json(reward)
  } catch (error) {
    console.error('Error updating reward:', error)
    return NextResponse.json(
      { error: 'Failed to update reward' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/loyalty/rewards/[id] - Delete reward
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const { id } = await params
    
    // Check if reward exists and has redemptions
    const existing = await prisma.reward.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            redemptions: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Reward not found' },
        { status: 404 }
      )
    }

    // Check if reward has been redeemed
    if (existing._count.redemptions > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete reward that has been redeemed',
          detail: 'Consider deactivating it instead'
        },
        { status: 400 }
      )
    }

    // Delete reward
    await prisma.reward.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reward:', error)
    return NextResponse.json(
      { error: 'Failed to delete reward' },
      { status: 500 }
    )
  }
}
