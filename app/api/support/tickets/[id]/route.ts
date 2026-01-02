import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/support/tickets/[id]
 * Get a specific support ticket with all messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ticket = await prisma.supportTicket.findUnique({
      where: {
        id,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
                productVariant: {
                  select: {
                    size: true,
                    color: true,
                  },
                },
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Support ticket not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: ticket,
    })
  } catch (error) {
    console.error('Error fetching support ticket:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch support ticket',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/support/tickets/[id]
 * Update a support ticket (status, assignment, resolution, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      status,
      priority,
      assignedToId,
      resolution,
      returnApproved,
      returnLabel,
    } = body

    const updateData: any = {}

    if (status) {
      updateData.status = status
      
      // Auto-set resolvedAt if status is RESOLVED or CLOSED
      if (status === 'RESOLVED' || status === 'CLOSED') {
        updateData.resolvedAt = new Date()
      }
    }

    if (priority) {
      updateData.priority = priority
    }

    if (assignedToId !== undefined) {
      updateData.assignedToId = assignedToId
      if (assignedToId) {
        updateData.assignedAt = new Date()
      }
    }

    if (resolution) {
      updateData.resolution = resolution
    }

    if (returnApproved !== undefined) {
      updateData.returnApproved = returnApproved
    }

    if (returnLabel) {
      updateData.returnLabel = returnLabel
    }

    const ticket = await prisma.supportTicket.update({
      where: {
        id,
      },
      data: updateData,
      include: {
        customer: true,
        order: true,
        assignedTo: true,
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: ticket,
      message: 'Support ticket updated successfully',
    })
  } catch (error) {
    console.error('Error updating support ticket:', error)
    return NextResponse.json(
      {
        error: 'Failed to update support ticket',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
