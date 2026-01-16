import { NextRequest, NextResponse } from 'next/server'
import { getTrackingInfo } from '@/lib/shipping/tracking'
import { prisma } from '@/lib/prisma'

// GET /api/orders/[id]/tracking/live - Get live tracking data with map info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get order with tracking info
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        trackingNumber: true,
        carrier: true,
        shippingAddress: {
          select: {
            city: true,
            state: true,
            postalCode: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (!order.trackingNumber) {
      return NextResponse.json(
        { error: 'No tracking information available', hasTracking: false },
        { status: 200 }
      )
    }

    // Get real-time tracking data
    const trackingData = await getTrackingInfo(
      order.trackingNumber,
      order.carrier || undefined
    )

    // Add destination from order shipping address
    if (order.shippingAddress && !trackingData.destinationLocation) {
      trackingData.destinationLocation = {
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        country: 'US',
        postalCode: order.shippingAddress.postalCode,
      }
    }

    // Auto-update order status based on tracking
    // If tracking shows delivered and order isn't marked as delivered yet
    if (trackingData.status === 'delivered' && order.status !== 'DELIVERED') {
      try {
        await prisma.order.update({
          where: { id },
          data: {
            status: 'DELIVERED',
            deliveredAt: trackingData.deliveredAt 
              ? new Date(trackingData.deliveredAt) 
              : new Date(),
          },
        })
        console.log(`Auto-updated order ${id} to DELIVERED based on tracking`)
      } catch (updateError) {
        console.error(`Failed to auto-update order ${id} status:`, updateError)
      }
    }

    // If tracking shows in transit and order is still in pre-ship status
    if (
      ['in_transit', 'out_for_delivery'].includes(trackingData.status) &&
      ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)
    ) {
      try {
        await prisma.order.update({
          where: { id },
          data: {
            status: 'SHIPPED',
            shippedAt: new Date(),
          },
        })
        console.log(`Auto-updated order ${id} to SHIPPED based on tracking (was ${order.status})`)
      } catch (updateError) {
        console.error(`Failed to auto-update order ${id} status:`, updateError)
      }
    }

    return NextResponse.json({ 
      data: trackingData,
      hasTracking: true,
    })
  } catch (error) {
    console.error('Error fetching live tracking:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tracking information' },
      { status: 500 }
    )
  }
}
