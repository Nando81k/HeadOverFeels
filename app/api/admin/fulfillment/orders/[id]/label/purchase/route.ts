import { NextRequest, NextResponse } from 'next/server'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getFulfillmentAuditLogger } from '@/lib/fulfillment/audit'
import { purchaseOutboundLabel } from '@/lib/shipping/easypost'

const PurchaseLabelSchema = z.object({
  rateId: z.string().trim().min(1).optional(),
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

    const currentOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        trackingNumber: true,
        carrier: true,
        trackingUrl: true,
      },
    })

    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const purchaseResult = await purchaseOutboundLabel(id, { rateId })
    if (!purchaseResult.success) {
      return NextResponse.json(
        {
          error: purchaseResult.error || 'Failed to purchase label',
          validationErrors: purchaseResult.validationErrors,
        },
        { status: purchaseResult.validationErrors ? 422 : 400 }
      )
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        trackingNumber: purchaseResult.trackingNumber || currentOrder.trackingNumber,
        trackingUrl: purchaseResult.trackingUrl || currentOrder.trackingUrl,
        carrier: purchaseResult.carrier || currentOrder.carrier,
        status: 'SHIPPED',
        shippedAt: new Date(),
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
        },
        after: {
          status: updatedOrder.status,
          trackingNumber: updatedOrder.trackingNumber,
          carrier: updatedOrder.carrier,
          trackingUrl: updatedOrder.trackingUrl,
        },
      },
      metadata: {
        rateId: purchaseResult.rateId,
        service: purchaseResult.service,
        rate: purchaseResult.rate,
        labelUrl: purchaseResult.labelUrl,
      },
    })

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

