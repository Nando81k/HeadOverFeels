import { NextRequest, NextResponse } from 'next/server'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getFulfillmentAuditLogger } from '@/lib/fulfillment/audit'
import { purchaseOutboundLabel } from '@/lib/shipping/easypost'
import { sendShippingNotification } from '@/lib/email/resend'
import { notifyOrderStatus } from '@/lib/notifications/service'

const PurchaseLabelSchema = z.object({
  rateId: z.string().trim().min(1).optional(),
  shipmentId: z.string().trim().min(1).optional(),
})

// POST /api/admin/fulfillment/orders/[id]/label/purchase
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
    const payload = PurchaseLabelSchema.safeParse(await request.json().catch(() => ({})))
    const rateId = payload.success ? payload.data.rateId : undefined
    const shipmentId = payload.success ? payload.data.shipmentId : undefined

    const currentOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        trackingNumber: true,
        carrier: true,
        trackingUrl: true,
        estimatedDelivery: true,
      },
    })

    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Idempotency guard — once an order has a tracking number, the carrier
    // shipment is real money already spent. A second Buy click (whether from
    // a double-tap, two operators racing, or a stale tab) must not create a
    // second shipment. Surface the existing tracking so the UI can update.
    if (currentOrder.trackingNumber) {
      return NextResponse.json(
        {
          error: 'This order already has a shipping label',
          alreadyPurchased: true,
          trackingNumber: currentOrder.trackingNumber,
          carrier: currentOrder.carrier,
          trackingUrl: currentOrder.trackingUrl,
        },
        { status: 409 }
      )
    }

    const purchaseResult = await purchaseOutboundLabel(id, { rateId, shipmentId })
    if (!purchaseResult.success) {
      return NextResponse.json(
        {
          error: purchaseResult.error || 'Failed to purchase label',
          validationErrors: purchaseResult.validationErrors,
        },
        { status: purchaseResult.validationErrors ? 422 : 400 }
      )
    }

    const parsedEstimatedDelivery = purchaseResult.estimatedDeliveryDate
      ? new Date(purchaseResult.estimatedDeliveryDate)
      : null
    const nextEstimatedDelivery =
      parsedEstimatedDelivery && !Number.isNaN(parsedEstimatedDelivery.getTime())
        ? parsedEstimatedDelivery
        : currentOrder.estimatedDelivery

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        trackingNumber: purchaseResult.trackingNumber || currentOrder.trackingNumber,
        trackingUrl: purchaseResult.trackingUrl || currentOrder.trackingUrl,
        carrier: purchaseResult.carrier || currentOrder.carrier,
        status: 'SHIPPED',
        shippedAt: new Date(),
        estimatedDelivery: nextEstimatedDelivery,
      },
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
    await audit.logOrder(AuditAction.STATUS_CHANGE, updatedOrder.id, 'Purchased outbound shipping label', {
      orderNumber: updatedOrder.orderNumber,
      changes: {
        before: {
          status: currentOrder.status,
          trackingNumber: currentOrder.trackingNumber,
          carrier: currentOrder.carrier,
          trackingUrl: currentOrder.trackingUrl,
          estimatedDelivery: currentOrder.estimatedDelivery,
        },
        after: {
          status: updatedOrder.status,
          trackingNumber: updatedOrder.trackingNumber,
          carrier: updatedOrder.carrier,
          trackingUrl: updatedOrder.trackingUrl,
          estimatedDelivery: updatedOrder.estimatedDelivery,
        },
      },
      metadata: {
        rateId: purchaseResult.rateId,
        service: purchaseResult.service,
        rate: purchaseResult.rate,
        labelUrl: purchaseResult.labelUrl,
        estimatedDeliveryDate: purchaseResult.estimatedDeliveryDate,
      },
    })

    // Fire-and-forget customer notification. Buying a label means the order
    // is going out today — the customer should know without the operator
    // having to remember a separate "Send tracking" click.
    if (updatedOrder.trackingNumber && updatedOrder.customerEmail) {
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
          shippingMethod: updatedOrder.shippingMethod || purchaseResult.service || 'Standard Shipping',
          trackingUrl: updatedOrder.trackingUrl || undefined,
          carrier: updatedOrder.carrier || purchaseResult.carrier || undefined,
          estimatedDelivery:
            updatedOrder.estimatedDelivery?.toISOString() ||
            purchaseResult.estimatedDeliveryDate ||
            null,
          shipToCity,
        })
      } catch (emailError) {
        // Log but don't fail the purchase — the label is real and money was
        // spent; the operator can re-send manually via the timeline's
        // "Send Tracking Update" affordance if needed.
        console.error(`Failed to send shipping notification for order ${updatedOrder.id}:`, emailError)
      }

      // In-app notification for signed-in customers — the bell ticks the
      // moment a label is bought, even if email is delayed or filtered.
      if (updatedOrder.customer?.id) {
        try {
          await notifyOrderStatus(
            updatedOrder.customer.id,
            updatedOrder.orderNumber,
            'shipped',
            updatedOrder.trackingUrl || undefined
          )
        } catch (notifError) {
          console.error(`Failed to write order-shipped notification for ${updatedOrder.id}:`, notifError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      label: purchaseResult,
    })
  } catch (error) {
    console.error('Failed to purchase outbound label:', error)
    return NextResponse.json(
      { error: 'Failed to purchase outbound label' },
      { status: 500 }
    )
  }
}

