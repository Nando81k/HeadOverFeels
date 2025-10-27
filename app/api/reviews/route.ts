import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/reviews - Submit a new review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      productId,
      rating,
      title,
      comment,
      customerName,
      customerEmail,
      customerId,
      orderId,
      images
    } = body

    // Validation
    if (!productId || !rating || !comment || !customerName || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, rating, comment, customerName, customerEmail' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
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

    // Check if this is a verified purchase
    let isVerified = false
    if (orderId) {
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          customerEmail: customerEmail,
          items: {
            some: {
              productId: productId
            }
          }
        }
      })
      isVerified = !!order
    } else if (customerId) {
      // Check if customer has purchased this product
      const order = await prisma.order.findFirst({
        where: {
          customerId: customerId,
          items: {
            some: {
              productId: productId
            }
          }
        }
      })
      isVerified = !!order
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        productId,
        rating,
        title: title || null,
        comment,
        customerName,
        customerEmail,
        customerId: customerId || null,
        orderId: orderId || null,
        isVerified,
        images: images ? JSON.stringify(images) : null,
        status: 'PENDING' // All reviews start as pending for moderation
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })

    return NextResponse.json({
      data: review,
      message: 'Review submitted successfully. It will be published after moderation.'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    )
  }
}

// GET /api/reviews - List all reviews (admin only)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') // PENDING, APPROVED, REJECTED, FLAGGED
    const productId = searchParams.get('productId')
    const sortBy = searchParams.get('sortBy') || 'newest' // newest, oldest, highest, lowest

    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (productId) {
      where.productId = productId
    }

    // Build orderBy clause
    let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' }
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' }
    } else if (sortBy === 'highest') {
      orderBy = { rating: 'desc' }
    } else if (sortBy === 'lowest') {
      orderBy = { rating: 'asc' }
    }

    // Fetch reviews
    const [reviews, totalCount] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: true
            }
          }
        }
      }),
      prisma.review.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      data: reviews,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    })

  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}
