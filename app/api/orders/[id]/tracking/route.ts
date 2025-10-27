import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// GET /api/orders/[id]/tracking - Get tracking information
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        trackingNumber: true,
        carrier: true,
        shippedAt: true,
        estimatedDelivery: true,
        deliveredAt: true,
        shippingMethod: true,
        customerEmail: true,
        shippingAddress: true,
        items: {
          include: {
            product: {
              select: {
                name: true,
                images: true,
                slug: true,
              },
            },
            productVariant: {
              select: {
                size: true,
                color: true,
              },
            },
          },
        },
        createdAt: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: order })
  } catch (error) {
    console.error('Error fetching order tracking:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tracking information' },
      { status: 500 }
    )
  }
}

// PATCH /api/orders/[id]/tracking - Update tracking information
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { trackingNumber, carrier, estimatedDelivery, sendEmail } = body

    // Validate required fields
    if (!trackingNumber || !carrier) {
      return NextResponse.json(
        { error: 'Tracking number and carrier are required' },
        { status: 400 }
      )
    }

    // Get current order to check if tracking is being added for first time
    const currentOrder = await prisma.order.findUnique({
      where: { id: params.id },
      select: {
        trackingNumber: true,
        customerEmail: true,
        orderNumber: true,
        shippingAddress: true,
      },
    })

    if (!currentOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const isFirstTimeTracking = !currentOrder.trackingNumber

    // Update order with tracking information
    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: {
        trackingNumber,
        carrier,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
        shippedAt: isFirstTimeTracking ? new Date() : undefined, // Set shippedAt only on first tracking
        status: 'CONFIRMED', // Update status to CONFIRMED when tracking added
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
        shippingAddress: true,
      },
    })

    // Send tracking email if requested
    if (sendEmail && isFirstTimeTracking) {
      try {
        const trackingUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/orders/${updatedOrder.id}/track`
        
        // Get carrier tracking URL
        const carrierUrls: Record<string, string> = {
          USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
          FedEx: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
          UPS: `https://www.ups.com/track?tracknum=${trackingNumber}`,
          DHL: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
        }

        const carrierTrackingUrl = carrierUrls[carrier] || trackingUrl

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'orders@headoverfeels.com',
          to: updatedOrder.customerEmail,
          subject: `Your Order Has Shipped! 📦 - Order #${updatedOrder.orderNumber}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                  .header h1 { color: white; margin: 0; font-size: 24px; }
                  .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
                  .tracking-box { background: #f9fafb; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
                  .tracking-number { font-size: 24px; font-weight: bold; color: #667eea; margin: 10px 0; letter-spacing: 2px; }
                  .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
                  .items { margin: 20px 0; }
                  .item { border-bottom: 1px solid #e5e7eb; padding: 10px 0; }
                  .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>📦 Your Order Has Shipped!</h1>
                  </div>
                  <div class="content">
                    <p>Great news! Your order <strong>#${updatedOrder.orderNumber}</strong> is on its way.</p>
                    
                    <div class="tracking-box">
                      <p style="margin: 0; color: #6b7280; font-size: 14px;">TRACKING NUMBER</p>
                      <div class="tracking-number">${trackingNumber}</div>
                      <p style="margin: 10px 0 0 0; color: #6b7280;">Carrier: <strong>${carrier}</strong></p>
                      ${estimatedDelivery ? `<p style="margin: 5px 0 0 0; color: #6b7280;">Estimated Delivery: <strong>${new Date(estimatedDelivery).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong></p>` : ''}
                    </div>

                    <div style="text-align: center;">
                      <a href="${carrierTrackingUrl}" class="button">Track Your Package</a>
                      <br>
                      <a href="${trackingUrl}" style="color: #667eea; font-size: 14px;">View Order Status</a>
                    </div>

                    <div class="items">
                      <h3 style="margin-bottom: 15px;">Your Items:</h3>
                      ${updatedOrder.items
                        .map(
                          (item) => `
                        <div class="item">
                          <strong>${item.product.name}</strong>
                          <br>
                          <span style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity} × $${item.price.toFixed(2)}</span>
                        </div>
                      `
                        )
                        .join('')}
                    </div>

                    <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-top: 20px;">
                      <h4 style="margin: 0 0 10px 0;">Shipping Address:</h4>
                      <p style="margin: 0; font-size: 14px;">
                        ${updatedOrder.shippingAddress.firstName} ${updatedOrder.shippingAddress.lastName}<br>
                        ${updatedOrder.shippingAddress.address1}<br>
                        ${updatedOrder.shippingAddress.address2 ? `${updatedOrder.shippingAddress.address2}<br>` : ''}
                        ${updatedOrder.shippingAddress.city}, ${updatedOrder.shippingAddress.state} ${updatedOrder.shippingAddress.zipCode}
                      </p>
                    </div>

                    <div class="footer">
                      <p>Questions about your order? Reply to this email or visit our <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/contact" style="color: #667eea;">contact page</a>.</p>
                      <p style="margin-top: 20px;">&copy; ${new Date().getFullYear()} Head Over Feels. All rights reserved.</p>
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `,
        })

        console.log('Tracking email sent successfully')
      } catch (emailError) {
        console.error('Failed to send tracking email:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ data: updatedOrder })
  } catch (error) {
    console.error('Error updating tracking:', error)
    return NextResponse.json(
      { error: 'Failed to update tracking information' },
      { status: 500 }
    )
  }
}
