import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AdminRole, verifyAdmin, verifyAdminRole } from '@/lib/auth/admin'
import { normalizeTierColor } from '@/lib/loyalty/tier-theme'

// GET /api/admin/loyalty/tiers/[id] - Get single tier
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const { id } = await params
    
    const tier = await prisma.loyaltyTier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    })

    if (!tier) {
      return NextResponse.json(
        { error: 'Tier not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(tier)
  } catch (error) {
    console.error('Error fetching tier:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tier' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/loyalty/tiers/[id] - Update tier
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
    
    // Check if tier exists
    const existing = await prisma.loyaltyTier.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Tier not found' },
        { status: 404 }
      )
    }

    // Update tier
    const tier = await prisma.loyaltyTier.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description ?? existing.description,
        primaryColor: normalizeTierColor(body.primaryColor, existing.primaryColor),
        secondaryColor: normalizeTierColor(body.secondaryColor, existing.secondaryColor),
        minAnnualPoints: body.minAnnualPoints ?? existing.minAnnualPoints,
        minAnnualSpend: body.minAnnualSpend ?? existing.minAnnualSpend,
        pointMultiplier: body.pointMultiplier ?? existing.pointMultiplier,
        freeShipping: body.freeShipping ?? existing.freeShipping,
        earlyDropAccess: body.earlyDropAccess ?? existing.earlyDropAccess,
        isInviteOnly: body.isInviteOnly ?? existing.isInviteOnly,
        perks: body.perks ?? existing.perks,
        sortOrder: body.sortOrder ?? existing.sortOrder,
        isActive: body.isActive ?? existing.isActive,
      },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    })

    return NextResponse.json(tier)
  } catch (error) {
    console.error('Error updating tier:', error)
    return NextResponse.json(
      { error: 'Failed to update tier' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/loyalty/tiers/[id] - Delete tier
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require SUPER_ADMIN — tier deletion is irreversible and affects loyalty program structure
    const adminId = await verifyAdminRole(request, AdminRole.SUPER_ADMIN)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - requires SUPER_ADMIN role' },
        { status: 403 }
      )
    }

    const { id } = await params
    
    const existing = await prisma.loyaltyTier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Tier not found' },
        { status: 404 }
      )
    }

    // Prevent deletion if tier has customers
    if (existing._count.customers > 0) {
      return NextResponse.json(
        { error: `Cannot delete tier with ${existing._count.customers} customers. Reassign customers first.` },
        { status: 400 }
      )
    }

    await prisma.loyaltyTier.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tier:', error)
    return NextResponse.json(
      { error: 'Failed to delete tier' },
      { status: 500 }
    )
  }
}
