import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET /api/admin/loyalty/tiers - Get all tiers
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

    const tiers = await prisma.loyaltyTier.findMany({
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    })

    return NextResponse.json(tiers)
  } catch (error) {
    console.error('Error fetching tiers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tiers' },
      { status: 500 }
    )
  }
}

// POST /api/admin/loyalty/tiers - Create new tier
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
    
    // Validate required fields
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Check for duplicate slug
    const existing = await prisma.loyaltyTier.findUnique({
      where: { slug: body.slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A tier with this slug already exists' },
        { status: 400 }
      )
    }

    // Get max sort order
    const maxSort = await prisma.loyaltyTier.aggregate({
      _max: { sortOrder: true },
    })

    // Create tier
    const tier = await prisma.loyaltyTier.create({
      data: {
        name: body.name,
        slug: body.slug.toLowerCase(),
        description: body.description || null,
        minAnnualPoints: body.minAnnualPoints || 0,
        minAnnualSpend: body.minAnnualSpend || 0,
        pointMultiplier: body.pointMultiplier || 1.0,
        freeShipping: body.freeShipping || false,
        earlyDropAccess: body.earlyDropAccess || false,
        isInviteOnly: body.isInviteOnly || false,
        perks: body.perks || null,
        sortOrder: body.sortOrder ?? ((maxSort._max.sortOrder || 0) + 1),
        isActive: body.isActive ?? true,
      },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    })

    return NextResponse.json(tier, { status: 201 })
  } catch (error) {
    console.error('Error creating tier:', error)
    return NextResponse.json(
      { error: 'Failed to create tier' },
      { status: 500 }
    )
  }
}
