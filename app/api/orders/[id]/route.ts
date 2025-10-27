import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendShippingNotification } from '@/lib/email/resend'
import { Prisma } from '@prisma/client'

// GET /api/orders/[id] - Get order by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // First, try to get the basic order data
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        shippingAddress: true,
        billingAddress: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Then get items separately to handle potential product deletion
    const items = await prisma.orderItem.findMany({
      where: { orderId: id },
    })

    // Try to enrich items with product data if available
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        try {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: {
              id: true,
              name: true,
              slug: true,
              images: true,
            },
          })

          let productVariant = null
          if (item.productVariantId) {
            productVariant = await prisma.productVariant.findUnique({
              where: { id: item.productVariantId },
              select: {
                id: true,
                sku: true,
                size: true,
                color: true,
              },
            })
          }

          return {
            ...item,
            product: product || {
              id: item.productId,
              name: item.productName,
              slug: '',
              images: item.productImage ? [item.productImage] : [],
            },
            productVariant,
          }
        } catch (err) {
          // If product lookup fails, use snapshot data
          console.error('Error fetching product for order item:', err)
          return {
            ...item,
            product: {
              id: item.productId,
              name: item.productName,
              slug: '',
              images: item.productImage ? [item.productImage] : [],
            },
            productVariant: null,
          }
        }
      })
    )

    const enrichedOrder = {
      ...order,
      items: enrichedItems,
    }

    return NextResponse.json({ data: enrichedOrder })
  } catch (error) {
    console.error('Order fetch error:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    
    // Log the specific Prisma error if available
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}

// PATCH /api/orders/[id] - Update order (for admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Get current order state to check for status changes
    const currentOrder = await prisma.order.findUnique({
      where: { id },
      select: { status: true },
    })

    if (!currentOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Only allow updating certain fields
    const allowedUpdates: Prisma.OrderUpdateInput = {}
    
    if (body.status) allowedUpdates.status = body.status
    if (body.paymentStatus) allowedUpdates.paymentStatus = body.paymentStatus
    if (body.trackingNumber !== undefined) allowedUpdates.trackingNumber = body.trackingNumber
    if (body.shippingMethod) allowedUpdates.shippingMethod = body.shippingMethod
    if (body.notes !== undefined) allowedUpdates.notes = body.notes
    if (body.internalNotes !== undefined) allowedUpdates.internalNotes = body.internalNotes

    // Set timestamps based on status changes
    if (body.status === 'SHIPPED' && !allowedUpdates.shippedAt) {
      allowedUpdates.shippedAt = new Date()
    }
    if (body.status === 'DELIVERED' && !allowedUpdates.deliveredAt) {
      allowedUpdates.deliveredAt = new Date()
    }

    const order = await prisma.order.update({
      where: { id },
      data: allowedUpdates,
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        customer: true,
        shippingAddress: true,
        billingAddress: true,
      },
    })

    // Send shipping notification if order was just shipped
    if (
      currentOrder.status !== 'SHIPPED' &&
      body.status === 'SHIPPED' &&
      order.trackingNumber
    ) {
      try {
        await sendShippingNotification({
          to: order.customerEmail,
          orderNumber: order.orderNumber,
          customerName: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
          trackingNumber: order.trackingNumber,
          shippingMethod: order.shippingMethod || 'Standard Shipping',
        })
        console.log(`Shipping notification sent for order ${order.id}`)
      } catch (emailError) {
        // Log error but don't fail the API request
        console.error(`Failed to send shipping notification for order ${order.id}:`, emailError)
      }
    }

    return NextResponse.json({ data: order })
  } catch (error) {
    console.error('Order update error:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}
