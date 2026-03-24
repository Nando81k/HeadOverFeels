import { NextRequest, NextResponse } from 'next/server'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getFulfillmentAuditLogger } from '@/lib/fulfillment/audit'
import { purchaseOutboundLabel } from '@/lib/shipping/easypost'

const BatchPurchaseSchema = z.object({
  orderIds: z.array(z.string().trim().min(1)).min(1).max(50),
})

type BatchLabelPurchaseResult = {
  orderId: string
  orderNumber: string | null
  success: boolean
  labelUrl?: string
  trackingNumber?: string
  carrier?: string
  service?: string
  rate?: number
  error?: string
}

// POST /api/admin/fulfillment/orders/labels/batch
export async function POST(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = BatchPurchaseSchema.parse(await request.json())
    const uniqueOrderIds = Array.from(new Set(body.orderIds))

    const orders = await prisma.order.findMany({
      where: {
        id: {
          in: uniqueOrderIds,
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        trackingNumber: true,
        carrier: true,
        trackingUrl: true,
      },
    })
    const orderMap = new Map(orders.map((order) => [order.id, order]))

    const audit = await getFulfillmentAuditLogger(adminId, request)
    const results: BatchLabelPurchaseResult[] = []

    for (const orderId of uniqueOrderIds) {
      const order = orderMap.get(orderId)
      if (!order) {
        results.push({
          orderId,
          orderNumber: null,
          success: false,
          error: 'Order not found',
        })
        continue
      }

      const purchaseResult = await purchaseOutboundLabel(orderId)
      if (!purchaseResult.success) {
        results.push({
          orderId,
          orderNumber: order.orderNumber,
          success: false,
          error: purchaseResult.error || 'Failed to purchase label',
        })
        continue
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          trackingNumber: purchaseResult.trackingNumber || order.trackingNumber,
          trackingUrl: purchaseResult.trackingUrl || order.trackingUrl,
          carrier: purchaseResult.carrier || order.carrier,
          status: 'SHIPPED',
          shippedAt: new Date(),
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          trackingNumber: true,
          trackingUrl: true,
          carrier: true,
        },
      })

      await audit.logOrder(AuditAction.BULK_UPDATE, updatedOrder.id, 'Purchased outbound label via batch operation', {
        orderNumber: updatedOrder.orderNumber,
        metadata: {
          rateId: purchaseResult.rateId,
          service: purchaseResult.service,
          rate: purchaseResult.rate,
          labelUrl: purchaseResult.labelUrl,
        },
      })

      results.push({
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        success: true,
        labelUrl: purchaseResult.labelUrl,
        trackingNumber: purchaseResult.trackingNumber,
        carrier: purchaseResult.carrier,
        service: purchaseResult.service,
        rate: purchaseResult.rate,
      })
    }

    const successCount = results.filter((result) => result.success).length
    const failedCount = results.length - successCount

    return NextResponse.json({
      success: failedCount === 0,
      summary: {
        requested: uniqueOrderIds.length,
        processed: results.length,
        succeeded: successCount,
        failed: failedCount,
      },
      results,
      printUrls: results.filter((result) => result.success && result.labelUrl).map((result) => result.labelUrl as string),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to process batch label purchase:', error)
    return NextResponse.json(
      { error: 'Failed to process batch label purchase' },
      { status: 500 }
    )
  }
}

