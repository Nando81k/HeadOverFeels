import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/loyalty/events/[id] - Get a specific event
export async function GET(request: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params

    const event = await prisma.pointsMultiplierEvent.findUnique({
      where: { id },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Add computed status
    const now = new Date()
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

    return NextResponse.json({ data: { ...event, computedStatus } })
  } catch (error) {
    console.error('Failed to fetch event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/loyalty/events/[id] - Update an event
const updateEventSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  multiplier: z.number().min(1.1).max(10).optional(),
  tierIds: z.array(z.string()).optional().nullable(),
  categoryIds: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateEventSchema.parse(body)

    // Check if event exists
    const existingEvent = await prisma.pointsMultiplierEvent.findUnique({
      where: { id },
    })

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}

    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.startDate !== undefined) updateData.startDate = new Date(validatedData.startDate)
    if (validatedData.endDate !== undefined) updateData.endDate = new Date(validatedData.endDate)
    if (validatedData.multiplier !== undefined) updateData.multiplier = validatedData.multiplier
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
    if (validatedData.tierIds !== undefined) {
      updateData.tierIds = validatedData.tierIds ? JSON.stringify(validatedData.tierIds) : null
    }
    if (validatedData.categoryIds !== undefined) {
      updateData.categoryIds = validatedData.categoryIds ? JSON.stringify(validatedData.categoryIds) : null
    }

    // Validate date range if both dates provided
    const startDate = updateData.startDate as Date || existingEvent.startDate
    const endDate = updateData.endDate as Date || existingEvent.endDate
    
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    const event = await prisma.pointsMultiplierEvent.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: event })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Failed to update event:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/loyalty/events/[id] - Delete an event
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params

    // Check if event exists
    const existingEvent = await prisma.pointsMultiplierEvent.findUnique({
      where: { id },
    })

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    await prisma.pointsMultiplierEvent.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Event deleted successfully' })
  } catch (error) {
    console.error('Failed to delete event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}
