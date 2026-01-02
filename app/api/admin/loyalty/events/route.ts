import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'

// GET /api/admin/loyalty/events - Get all multiplier events
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'all', 'active', 'upcoming', 'past'
    const now = new Date()

    let whereClause = {}
    
    switch (status) {
      case 'active':
        whereClause = {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        }
        break
      case 'upcoming':
        whereClause = {
          isActive: true,
          startDate: { gt: now },
        }
        break
      case 'past':
        whereClause = {
          endDate: { lt: now },
        }
        break
      // 'all' or default - no additional filter
    }

    const events = await prisma.pointsMultiplierEvent.findMany({
      where: whereClause,
      orderBy: { startDate: 'desc' },
    })

    // Add computed status to each event
    const eventsWithStatus = events.map(event => {
      let computedStatus: 'active' | 'upcoming' | 'past' | 'inactive' = 'inactive'
      if (!event.isActive) {
        computedStatus = 'inactive'
      } else if (event.startDate <= now && event.endDate >= now) {
        computedStatus = 'active'
      } else if (event.startDate > now) {
        computedStatus = 'upcoming'
      } else {
        computedStatus = 'past'
      }
      return { ...event, computedStatus }
    })

    return NextResponse.json({ data: eventsWithStatus })
  } catch (error) {
    console.error('Failed to fetch multiplier events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// POST /api/admin/loyalty/events - Create a new multiplier event
const createEventSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  multiplier: z.number().min(1.1).max(10).default(2.0),
  tierIds: z.array(z.string()).optional().nullable(),
  categoryIds: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const validatedData = createEventSchema.parse(body)

    // Validate date range
    const startDate = new Date(validatedData.startDate)
    const endDate = new Date(validatedData.endDate)
    
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    const event = await prisma.pointsMultiplierEvent.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        startDate,
        endDate,
        multiplier: validatedData.multiplier,
        tierIds: validatedData.tierIds ? JSON.stringify(validatedData.tierIds) : null,
        categoryIds: validatedData.categoryIds ? JSON.stringify(validatedData.categoryIds) : null,
        isActive: validatedData.isActive,
      },
    })

    return NextResponse.json({ data: event })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Failed to create multiplier event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
