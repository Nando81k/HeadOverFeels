import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTrackingInfo } from '@/lib/shipping/tracking'

/**
 * CRON: Sync Order Status with Tracking
 * 
 * This endpoint should be called periodically (e.g., every hour) to sync
 * order statuses with their tracking information.
 * 
 * It will:
 * - Find all orders with tracking numbers that aren't delivered
 * - Fetch live tracking data for each
 * - Update order status if tracking shows delivered or in-transit
 * 
 * Usage: Set up a cron job or Vercel Cron to call this endpoint
 * 
 * Security: Add CRON_SECRET env var and pass it as Authorization header
 */

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find orders with tracking that aren't delivered yet
    const ordersToSync = await prisma.order.findMany({
      where: {
        trackingNumber: { not: null },
        status: {
          in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'],
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        trackingNumber: true,
        carrier: true,
      },
      take: 50, // Limit batch size to avoid timeouts
      orderBy: {
        updatedAt: 'asc', // Process oldest updated first
      },
    })

    if (ordersToSync.length === 0) {
      return NextResponse.json({
        message: 'No orders to sync',
        synced: 0,
      })
    }

    const results = {
      synced: 0,
      updated: 0,
      errors: 0,
      details: [] as Array<{
        orderId: string
        orderNumber: string
        action: string
        newStatus?: string
      }>,
    }

    // Process each order
    for (const order of ordersToSync) {
      try {
        if (!order.trackingNumber) continue

        const trackingData = await getTrackingInfo(
          order.trackingNumber,
          order.carrier || undefined
        )

        results.synced++

        // Check if status should be updated
        let newStatus: string | null = null
        let updateData: Record<string, unknown> = {}

        if (trackingData.status === 'delivered' && order.status !== 'DELIVERED') {
          newStatus = 'DELIVERED'
          updateData = {
            status: 'DELIVERED',
            deliveredAt: trackingData.deliveredAt 
              ? new Date(trackingData.deliveredAt) 
              : new Date(),
          }
        } else if (
          ['in_transit', 'out_for_delivery'].includes(trackingData.status) &&
          ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)
        ) {
          newStatus = 'SHIPPED'
          updateData = {
            status: 'SHIPPED',
            shippedAt: new Date(),
          }
        }

        if (newStatus) {
          await prisma.order.update({
            where: { id: order.id },
            data: updateData,
          })

          results.updated++
          results.details.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            action: 'status_updated',
            newStatus,
          })

          console.log(
            `[Tracking Sync] Order ${order.orderNumber}: ${order.status} → ${newStatus}`
          )
        } else {
          results.details.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            action: 'no_change',
          })
        }

        // Add small delay between API calls to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (orderError) {
        results.errors++
        console.error(
          `[Tracking Sync] Error processing order ${order.orderNumber}:`,
          orderError
        )
        results.details.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          action: 'error',
        })
      }
    }

    console.log(
      `[Tracking Sync] Complete: ${results.synced} checked, ${results.updated} updated, ${results.errors} errors`
    )

    return NextResponse.json({
      message: 'Tracking sync complete',
      ...results,
    })
  } catch (error) {
    console.error('[Tracking Sync] Fatal error:', error)
    return NextResponse.json(
      { error: 'Failed to sync tracking' },
      { status: 500 }
    )
  }
}

// Also support POST for webhook-style calls
export async function POST(request: NextRequest) {
  return GET(request)
}
