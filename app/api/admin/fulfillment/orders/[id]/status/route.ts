import { NextRequest, NextResponse } from 'next/server'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getFulfillmentAuditLogger } from '@/lib/fulfillment/audit'
import { appendHighValueHoldReviewMarker } from '@/lib/fulfillment/high-value-hold'
import { sendShippingNotification } from '@/lib/email/resend'
import { notifyOrderStatus } from '@/lib/notifications/service'

const UpdateOrderStatusSchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
    .optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
  trackingNumber: z.string().max(80).optional(),
  carrier: z.string().max(80).optional(),
  trackingUrl: z.string().url().or(z.literal('')).optional(),
  estimatedDelivery: z.string().or(z.literal('')).optional(),
  internalNotes: z.string().max(4000).optional(),
  reviewHighValueHold: z.boolean().optional(),
})

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

// PATCH /api/admin/fulfillment/orders/[id]/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = UpdateOrderStatusSchema.parse(await request.json())

    const currentOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        trackingNumber: true,
        carrier: true,
        trackingUrl: true,
        estimatedDelivery: true,
        internalNotes: true,
        // shippedAt is the idempotency key — if the order has ever been
        // shipped (even if status was later toggled back), we don't want
        // to re-fire the customer notification when it transitions to
        // SHIPPED again.
        shippedAt: true,
      },
    })

    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const trackingNumber = normalizeOptionalText(body.trackingNumber)
    const carrier = normalizeOptionalText(body.carrier)
    const trackingUrl = body.trackingUrl === '' ? null : body.trackingUrl
    const internalNotes = body.internalNotes?.trim()

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber || null
    if (carrier !== undefined) updateData.carrier = carrier || null
    if (body.trackingUrl !== undefined) updateData.trackingUrl = trackingUrl
    if (body.estimatedDelivery !== undefined) {
      const trimmed = body.estimatedDelivery.trim()
      if (!trimmed) {
        updateData.estimatedDelivery = null
      } else {
        const parsed = new Date(trimmed)
        updateData.estimatedDelivery = Number.isNaN(parsed.getTime()) ? null : parsed
      }
    }

    let nextInternalNotes: string | null | undefined = undefined
    if (body.internalNotes !== undefined) {
      nextInternalNotes = internalNotes || null
    }
    if (body.reviewHighValueHold) {
      const baseNotes = nextInternalNotes ?? currentOrder.internalNotes
      nextInternalNotes = appendHighValueHoldReviewMarker(baseNotes)
    }
    if (nextInternalNotes !== undefined && nextInternalNotes !== currentOrder.internalNotes) {
      updateData.internalNotes = nextInternalNotes
    }

    const finalStatus = (updateData.status as string | undefined) || currentOrder.status
    if (finalStatus === 'SHIPPED') {
      updateData.shippedAt = new Date()
    }
    if (finalStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    }

    const incomingTracking = trackingNumber ?? currentOrder.trackingNumber
    if (
      incomingTracking &&
      currentOrder.status !== 'SHIPPED' &&
      currentOrder.status !== 'DELIVERED' &&
      !updateData.status
    ) {
      updateData.status = 'SHIPPED'
      updateData.shippedAt = new Date()
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        shippingAddress: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const audit = await getFulfillmentAuditLogger(adminId, request)
    const action =
      currentOrder.status !== updatedOrder.status || currentOrder.paymentStatus !== updatedOrder.paymentStatus
        ? AuditAction.STATUS_CHANGE
        : AuditAction.UPDATE

    await audit.logOrder(action, updatedOrder.id, 'Updated order fulfillment state from fulfillment center', {
      orderNumber: updatedOrder.orderNumber,
      changes: {
        before: {
          status: currentOrder.status,
          paymentStatus: currentOrder.paymentStatus,
          trackingNumber: currentOrder.trackingNumber,
          carrier: currentOrder.carrier,
          trackingUrl: currentOrder.trackingUrl,
          estimatedDelivery: currentOrder.estimatedDelivery,
          internalNotes: currentOrder.internalNotes,
        },
        after: {
          status: updatedOrder.status,
          paymentStatus: updatedOrder.paymentStatus,
          trackingNumber: updatedOrder.trackingNumber,
          carrier: updatedOrder.carrier,
          trackingUrl: updatedOrder.trackingUrl,
          estimatedDelivery: updatedOrder.estimatedDelivery,
          internalNotes: updatedOrder.internalNotes,
        },
      },
    })

    // First-time SHIPPED transition fires the customer "your order has
    // shipped" email automatically. Conditions:
    //   - Order wasn't shipped before (shippedAt was null)
    //   - Order is shipped now (final status SHIPPED or DELIVERED)
    //   - We have a tracking number to put in the email
    const wasShippedBefore = Boolean(currentOrder.shippedAt)
    const isShippedNow = updatedOrder.status === 'SHIPPED' || updatedOrder.status === 'DELIVERED'
    if (
      !wasShippedBefore &&
      isShippedNow &&
      updatedOrder.trackingNumber &&
      updatedOrder.customerEmail
    ) {
      const customerName = updatedOrder.shippingAddress
        ? `${updatedOrder.shippingAddress.firstName} ${updatedOrder.shippingAddress.lastName}`.trim()
        : updatedOrder.customer?.name || 'Customer'
      const shipToCity = updatedOrder.shippingAddress
        ? [updatedOrder.shippingAddress.city, updatedOrder.shippingAddress.state]
            .filter(Boolean)
            .join(', ') || null
        : null
      try {
        await sendShippingNotification({
          to: updatedOrder.customerEmail,
          orderNumber: updatedOrder.orderNumber,
          customerName,
          trackingNumber: updatedOrder.trackingNumber,
          shippingMethod: updatedOrder.shippingMethod || 'Standard Shipping',
          trackingUrl: updatedOrder.trackingUrl || undefined,
          carrier: updatedOrder.carrier || undefined,
          estimatedDelivery: updatedOrder.estimatedDelivery?.toISOString() || null,
          shipToCity,
        })
      } catch (emailError) {
        // Email failure shouldn't fail the status update — the order is
        // shipped in the database. Operator can resend manually via the
        // timeline's Notify Customer step if needed.
        console.error(`Failed to send shipping notification for order ${updatedOrder.id}:`, emailError)
      }
    }

    // Mirror status transitions into the in-app notification feed. Fires on
    // any transition into SHIPPED or DELIVERED so customers see it even when
    // the email is filtered or the operator skips the auto-email.
    const transitionedToShippedOrDelivered =
      currentOrder.status !== updatedOrder.status &&
      (updatedOrder.status === 'SHIPPED' || updatedOrder.status === 'DELIVERED')
    if (transitionedToShippedOrDelivered && updatedOrder.customer?.id) {
      try {
        await notifyOrderStatus(
          updatedOrder.customer.id,
          updatedOrder.orderNumber,
          updatedOrder.status === 'SHIPPED' ? 'shipped' : 'delivered',
          updatedOrder.trackingUrl || undefined
        )
      } catch (notifError) {
        console.error(`Failed to write order-status notification for ${updatedOrder.id}:`, notifError)
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update fulfillment order status:', error)
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 }
    )
  }
}
