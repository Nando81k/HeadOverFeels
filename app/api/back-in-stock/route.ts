/**
 * Back-in-Stock Notifications API
 * 
 * POST /api/back-in-stock - Subscribe to notifications
 * DELETE /api/back-in-stock - Unsubscribe from notifications
 * GET /api/back-in-stock - Get subscription status/list
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { 
  subscribeToBackInStock, 
  unsubscribeFromBackInStock,
  isSubscribed,
  getCustomerSubscriptions
} from '@/lib/back-in-stock'

// POST: Subscribe to back-in-stock notification
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, variantId, email } = body

    if (!productId || !email) {
      return NextResponse.json(
        { error: 'productId and email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Get customer ID if logged in
    const session = await auth()
    const customerId = session?.user?.id

    const subscription = await subscribeToBackInStock({
      productId,
      variantId,
      email,
      customerId,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        productName: subscription.product.name,
        variantInfo: subscription.variant 
          ? `${subscription.variant.size || ''} ${subscription.variant.color || ''}`.trim()
          : null,
        message: "You'll be notified when this item is back in stock!",
      },
    })
  } catch (error) {
    console.error('Back-in-stock subscription error:', error)
    
    if (error instanceof Error && error.message === 'Product not found') {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to subscribe to notifications' },
      { status: 500 }
    )
  }
}

// DELETE: Unsubscribe from back-in-stock notification
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId')
    const variantId = searchParams.get('variantId')
    const email = searchParams.get('email')

    if (!productId || !email) {
      return NextResponse.json(
        { error: 'productId and email are required' },
        { status: 400 }
      )
    }

    await unsubscribeFromBackInStock(productId, email, variantId || undefined)

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from notifications',
    })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    )
  }
}

// GET: Check subscription status or list subscriptions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId')
    const variantId = searchParams.get('variantId')
    const email = searchParams.get('email')

    // If checking specific product subscription
    if (productId && email) {
      const subscribed = await isSubscribed(productId, email, variantId || undefined)
      return NextResponse.json({
        success: true,
        data: { isSubscribed: subscribed },
      })
    }

    // If listing all subscriptions (requires auth or email)
    const session = await auth()
    const customerId = session?.user?.id

    if (!customerId && !email) {
      return NextResponse.json(
        { error: 'Authentication required or provide email' },
        { status: 401 }
      )
    }

    const subscriptions = await getCustomerSubscriptions(customerId, email || undefined)

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          productId: sub.productId,
          productName: sub.product.name,
          productSlug: sub.product.slug,
          productImage: JSON.parse(sub.product.images)[0] || null,
          variantId: sub.variantId,
          variantInfo: sub.variant 
            ? `${sub.variant.size || ''} ${sub.variant.color || ''}`.trim()
            : null,
          subscribedAt: sub.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error('Get subscriptions error:', error)
    return NextResponse.json(
      { error: 'Failed to get subscriptions' },
      { status: 500 }
    )
  }
}
