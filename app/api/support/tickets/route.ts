import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * GET /api/support/tickets
 * List support tickets (filtered by customer or all for admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause with proper typing
    const where: Prisma.SupportTicketWhereInput = {}

    if (customerId) {
      where.customerId = customerId
    }

    if (status) {
      where.status = status as Prisma.EnumSupportTicketStatusFilter['equals']
    }

    if (type) {
      where.type = type as Prisma.EnumSupportTicketTypeFilter['equals']
    }

    if (priority) {
      where.priority = priority as Prisma.EnumSupportPriorityFilter['equals']
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search } },
        { subject: { contains: search } },
        { customerName: { contains: search } },
        { customerEmail: { contains: search } },
        { orderNumber: { contains: search } },
      ]
    }

    // Get total count for pagination
    const totalCount = await prisma.supportTicket.count({ where })

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            createdAt: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      success: true,
      tickets,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching support tickets:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch support tickets',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/support/tickets
 * Create a new support ticket
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      type,
      subject,
      customerId,
      customerEmail,
      customerName,
      orderId,
      orderNumber,
      refundAmount,
      refundReason,
      returnRequested,
      message,
      aiAssisted,
      aiSummary,
    } = body

    // Validation
    if (!type || !subject || !customerEmail || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: type, subject, customerEmail, customerName' },
        { status: 400 }
      )
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Initial message is required' },
        { status: 400 }
      )
    }

    // Generate ticket number
    const ticketCount = await prisma.supportTicket.count()
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(6, '0')}`

    // Determine priority based on type
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM'
    if (type === 'REFUND' || type === 'PAYMENT_ISSUE') {
      priority = 'HIGH'
    } else if (type === 'PRODUCT_QUESTION' || type === 'GENERAL') {
      priority = 'LOW'
    }

    // Create ticket with initial message
    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        type,
        subject,
        customerId,
        customerEmail,
        customerName,
        orderId,
        orderNumber,
        refundAmount,
        refundReason,
        returnRequested: returnRequested || false,
        priority,
        aiAssisted: aiAssisted || false,
        aiSummary,
        messages: {
          create: {
            message,
            senderType: 'customer',
            senderId: customerId,
            senderName: customerName,
          },
        },
      },
      include: {
        messages: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: ticket,
      message: `Support ticket ${ticketNumber} created successfully`,
    })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    return NextResponse.json(
      {
        error: 'Failed to create support ticket',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
