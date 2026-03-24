import { NextRequest, NextResponse } from 'next/server'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getFulfillmentAuditLogger } from '@/lib/fulfillment/audit'

const CreateMessageSchema = z.object({
  message: z.string().trim().min(1).max(6000),
  isInternal: z.boolean().optional().default(true),
  nextStatus: z
    .enum(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'])
    .optional(),
})

// POST /api/admin/fulfillment/tickets/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const payload = CreateMessageSchema.parse(await request.json())

    const [ticket, admin] = await Promise.all([
      prisma.supportTicket.findUnique({
        where: { id },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
        },
      }),
      prisma.customer.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
    ])

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const senderName = admin?.name || admin?.email || 'Fulfillment Admin'

    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.supportMessage.create({
        data: {
          ticketId: id,
          message: payload.message,
          isInternal: payload.isInternal,
          senderType: 'admin',
          senderId: adminId,
          senderName,
        },
      })

      const shouldUpdateStatus = payload.nextStatus && payload.nextStatus !== ticket.status
      if (shouldUpdateStatus) {
        await tx.supportTicket.update({
          where: { id },
          data: {
            status: payload.nextStatus,
          },
        })
      }

      return {
        message,
        statusUpdated: shouldUpdateStatus,
      }
    })

    const audit = await getFulfillmentAuditLogger(adminId, request)
    await audit.logSupportTicket(
      AuditAction.UPDATE,
      id,
      payload.isInternal
        ? 'Added internal fulfillment note to support ticket'
        : 'Sent fulfillment response to customer',
      {
        ticketNumber: ticket.ticketNumber,
        metadata: {
          isInternal: payload.isInternal,
          nextStatus: payload.nextStatus || null,
          messageId: result.message.id,
        },
      }
    )

    return NextResponse.json({
      success: true,
      message: {
        ...result.message,
        createdAt: result.message.createdAt.toISOString(),
      },
      statusUpdated: result.statusUpdated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to send fulfillment ticket message:', error)
    return NextResponse.json(
      { error: 'Failed to send ticket message' },
      { status: 500 }
    )
  }
}
