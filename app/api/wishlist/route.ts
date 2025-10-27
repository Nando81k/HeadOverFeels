import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

// Generate session ID for guest users
async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies()
  let sessionId = cookieStore.get('wishlist_session')?.value
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }
  
  return sessionId
}

// POST /api/wishlist - Add item to wishlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      productId,
      productVariantId,
      customerId,
      notes,
      priority
    } = body

    // Validation
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get session ID for guest users
    const sessionId = customerId ? null : await getOrCreateSessionId()

    // Check if item already in wishlist
    const existingItem = await prisma.wishlistItem.findFirst({
      where: customerId
        ? {
            customerId,
            productId,
            productVariantId: productVariantId || null
          }
        : {
            sessionId,
            productId,
            productVariantId: productVariantId || null
          }
    })

    if (existingItem) {
      return NextResponse.json(
        { error: 'Item already in wishlist', data: existingItem },
        { status: 409 }
      )
    }

    // Create wishlist item
    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        productId,
        productVariantId: productVariantId || null,
        customerId: customerId || null,
        sessionId,
        notes: notes || null,
        priority: priority || 0
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            images: true,
            isActive: true
          }
        },
        productVariant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            price: true,
            inventory: true
          }
        }
      }
    })

    const response = NextResponse.json({
      data: wishlistItem,
      message: 'Item added to wishlist'
    }, { status: 201 })

    // Set session cookie for guest users
    if (!customerId) {
      const finalSessionId = await sessionId
      if (finalSessionId) {
        response.cookies.set('wishlist_session', finalSessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365 // 1 year
        })
      }
    }

    return response

  } catch (error) {
    console.error('Error adding to wishlist:', error)
    return NextResponse.json(
      { error: 'Failed to add item to wishlist' },
      { status: 500 }
    )
  }
}

// GET /api/wishlist - Get user's wishlist items
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const sessionId = customerId ? null : await getOrCreateSessionId()

    const wishlistItems = await prisma.wishlistItem.findMany({
      where: customerId
        ? { customerId }
        : { sessionId },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            images: true,
            isActive: true,
            isLimitedEdition: true,
            releaseDate: true,
            dropEndDate: true
          }
        },
        productVariant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            price: true,
            inventory: true,
            isActive: true
          }
        }
      }
    })

    return NextResponse.json({
      data: wishlistItems,
      count: wishlistItems.length
    })

  } catch (error) {
    console.error('Error fetching wishlist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wishlist' },
      { status: 500 }
    )
  }
}
