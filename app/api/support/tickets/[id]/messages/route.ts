import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/support/tickets/[id]/messages
 * Add a message to a support ticket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      message,
      senderType,
      senderId,
      senderName,
      isInternal,
      attachments,
    } = body

    // Validation
    if (!message || !senderType || !senderName) {
      return NextResponse.json(
        { error: 'Missing required fields: message, senderType, senderName' },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Support ticket not found' },
        { status: 404 }
      )
    }

    // Create message
    const newMessage = await prisma.supportMessage.create({
      data: {
        ticketId: id,
        message,
        senderType,
        senderId,
        senderName,
        isInternal: isInternal || false,
        attachments: attachments ? JSON.stringify(attachments) : null,
      },
    })

    // Update ticket status if it was resolved/closed and customer is responding
    if (
      senderType === 'customer' &&
      (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')
    ) {
      await prisma.supportTicket.update({
        where: { id },
        data: {
          status: 'OPEN',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: newMessage,
      message: 'Message added successfully',
    })
  } catch (error) {
    console.error('Error adding message to ticket:', error)
    return NextResponse.json(
      {
        error: 'Failed to add message',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/support/tickets/[id]/messages
 * Get all messages for a support ticket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const messages = await prisma.supportMessage.findMany({
      where: {
        ticketId: id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: messages,
    })
  } catch (error) {
    console.error('Error fetching ticket messages:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch messages',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
