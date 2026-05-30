import { NextRequest, NextResponse } from 'next/server'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import { AdminRole, verifyAdminRole } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getFulfillmentAuditLogger } from '@/lib/fulfillment/audit'
import { generateReturnLabel } from '@/lib/support/refund-helpers'

const DecisionSchema = z.object({
  action: z.enum([
    'approve_return',
    'deny_return',
    'mark_refund_requested',
    'approve_refund',
    'complete_refund',
    'deny_refund',
    'update_status',
  ]),
  status: z
    .enum(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'])
    .optional(),
  note: z.string().trim().max(2000).optional(),
  externalReference: z.string().trim().max(200).optional(),
  generateLabel: z.boolean().optional(),
})

function composeResolution(currentResolution: string | null, fragment: string) {
  if (!currentResolution || currentResolution.trim().length === 0) {
    return fragment
  }
  return `${currentResolution}\n${fragment}`
}

// PATCH /api/admin/fulfillment/tickets/[id]/decision
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require SUPER_ADMIN — refund and return decisions involve financial mutations
    const adminId = await verifyAdminRole(request, AdminRole.SUPER_ADMIN)
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - requires SUPER_ADMIN role' },
        { status: 403 }
      )
    }

    const { id } = await params
    const payload = DecisionSchema.parse(await request.json())

    const currentTicket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    })

    if (!currentTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    let nextStatus = payload.status
    let nextReturnApproved: boolean | null | undefined
    let nextReturnLabel: string | undefined
    let resolutionFragment = ''
    let auditAction: AuditAction = AuditAction.UPDATE
    let refundAuditAction: AuditAction | null = null

    if (payload.action === 'approve_return') {
      nextReturnApproved = true
      nextStatus = nextStatus || 'IN_PROGRESS'
      resolutionFragment = `Return approved by admin${payload.externalReference ? ` (${payload.externalReference})` : ''}`
      auditAction = AuditAction.APPROVE
    } else if (payload.action === 'deny_return') {
      nextReturnApproved = false
      nextStatus = nextStatus || 'RESOLVED'
      resolutionFragment = `Return denied by admin${payload.externalReference ? ` (${payload.externalReference})` : ''}`
      auditAction = AuditAction.REJECT
    } else if (payload.action === 'mark_refund_requested') {
      nextStatus = nextStatus || 'IN_PROGRESS'
      resolutionFragment = 'Refund request marked for review'
      auditAction = AuditAction.STATUS_CHANGE
      refundAuditAction = AuditAction.REFUND
    } else if (payload.action === 'approve_refund') {
      nextStatus = nextStatus || 'IN_PROGRESS'
      resolutionFragment = `Refund approved${payload.externalReference ? ` (reference: ${payload.externalReference})` : ''}`
      auditAction = AuditAction.APPROVE
      refundAuditAction = AuditAction.REFUND
    } else if (payload.action === 'complete_refund') {
      nextStatus = nextStatus || 'RESOLVED'
      resolutionFragment = `Refund completed${payload.externalReference ? ` (reference: ${payload.externalReference})` : ''}`
      auditAction = AuditAction.STATUS_CHANGE
      refundAuditAction = AuditAction.REFUND
    } else if (payload.action === 'deny_refund') {
      nextStatus = nextStatus || 'RESOLVED'
      resolutionFragment = `Refund denied${payload.externalReference ? ` (reference: ${payload.externalReference})` : ''}`
      auditAction = AuditAction.REJECT
      refundAuditAction = AuditAction.REFUND
    } else if (payload.action === 'update_status') {
      if (!nextStatus) {
        return NextResponse.json(
          { error: 'status is required for update_status' },
          { status: 400 }
        )
      }
      resolutionFragment = `Status updated to ${nextStatus}`
      auditAction = AuditAction.STATUS_CHANGE
    }

    if (payload.action === 'approve_return' && payload.generateLabel && currentTicket.orderId) {
      const label = await generateReturnLabel(currentTicket.orderId)
      nextReturnLabel = label.labelUrl
    }

    const updatedTicket = await prisma.$transaction(async (tx) => {
      if (
        payload.action === 'complete_refund' &&
        currentTicket.orderId &&
        currentTicket.order
      ) {
        await tx.order.update({
          where: { id: currentTicket.orderId },
          data: {
            status: 'REFUNDED',
            paymentStatus: 'REFUNDED',
          },
        })
      }

      const ticket = await tx.supportTicket.update({
        where: { id },
        data: {
          status: nextStatus,
          returnApproved: nextReturnApproved,
          returnLabel: nextReturnLabel || undefined,
          resolvedAt: nextStatus === 'RESOLVED' || nextStatus === 'CLOSED' ? new Date() : null,
          resolution: resolutionFragment
            ? composeResolution(currentTicket.resolution, resolutionFragment)
            : currentTicket.resolution,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paymentStatus: true,
              total: true,
              trackingNumber: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
            take: 50,
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      if (payload.note && payload.note.length > 0) {
        await tx.supportMessage.create({
          data: {
            ticketId: ticket.id,
            message: payload.note,
            isInternal: true,
            senderType: 'admin',
            senderId: adminId,
            senderName: 'Fulfillment Admin',
          },
        })
      }

      return ticket
    })

    const audit = await getFulfillmentAuditLogger(adminId, request)
    await audit.logSupportTicket(auditAction, updatedTicket.id, 'Applied fulfillment ticket decision', {
      ticketNumber: updatedTicket.ticketNumber,
      metadata: {
        action: payload.action,
        status: updatedTicket.status,
        returnApproved: updatedTicket.returnApproved,
        returnLabel: updatedTicket.returnLabel,
      },
    })

    if (refundAuditAction && updatedTicket.orderId) {
      await audit.logRefund(refundAuditAction, updatedTicket.orderId, 'Updated refund workflow state from fulfillment center', {
        orderNumber: updatedTicket.orderNumber || undefined,
        amount: updatedTicket.refundAmount || undefined,
        metadata: {
          ticketId: updatedTicket.id,
          action: payload.action,
          externalReference: payload.externalReference,
        },
      })
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to apply fulfillment ticket decision:', error)
    return NextResponse.json(
      { error: 'Failed to apply ticket decision' },
      { status: 500 }
    )
  }
}

