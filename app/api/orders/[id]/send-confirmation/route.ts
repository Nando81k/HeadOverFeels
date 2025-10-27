import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOrderConfirmationEmail } from '@/lib/email/send'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Fetch the complete order with all details
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        shippingAddress: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Format items for email
    const emailItems = order.items.map((item) => ({
      product: {
        name: item.product.name,
        slug: item.product.slug,
      },
      variant: {
        size: item.productVariant?.size || undefined,
        color: item.productVariant?.color || undefined,
        sku: item.productVariant?.sku || '',
      },
      quantity: item.quantity,
      price: item.price,
    }))

    // Format shipping address
    const shippingAddr = order.shippingAddress
    const shippingAddress = {
      fullName: `${shippingAddr.firstName} ${shippingAddr.lastName}`,
      address: shippingAddr.address1 + (shippingAddr.address2 ? ` ${shippingAddr.address2}` : ''),
      city: shippingAddr.city,
      state: shippingAddr.state,
      zipCode: shippingAddr.postalCode,
      country: shippingAddr.country,
    }

    // Send confirmation email
    const result = await sendOrderConfirmationEmail({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      items: emailItems,
      subtotal: order.subtotal,
      shipping: order.shipping,
      tax: order.tax,
      total: order.total,
      shippingAddress,
      createdAt: order.createdAt,
      trackingNumber: (order as any).trackingNumber || undefined,
      trackingUrl: (order as any).trackingUrl || undefined,
      carrier: (order as any).carrier || undefined,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Confirmation email sent successfully',
      data: result.data,
    })
  } catch (error) {
    console.error('Error sending confirmation email:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
