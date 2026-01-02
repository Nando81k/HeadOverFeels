import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ReviewSubmitSchema, sanitizeString, getPaginationParams, createPaginatedResponse } from '@/lib/validation/schemas'

// POST /api/reviews - Submit a new review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate and sanitize input
    const validatedData = ReviewSubmitSchema.parse(body)
    
    // Double-check that comment and title don't contain malicious content
    const sanitizedComment = sanitizeString(validatedData.comment)
    const sanitizedTitle = validatedData.title ? sanitizeString(validatedData.title) : null

    // Additional validation: check product exists
    const product = await prisma.product.findUnique({
      where: { id: validatedData.productId },
      select: { id: true, name: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // PURCHASE VERIFICATION: User must have purchased the product to leave a review
    const purchaseOrder = await prisma.order.findFirst({
      where: {
        OR: [
          validatedData.customerId ? { customerId: validatedData.customerId } : {},
          { customerEmail: validatedData.customerEmail },
        ].filter(obj => Object.keys(obj).length > 0),
        status: {
          in: ['DELIVERED', 'SHIPPED', 'PROCESSING', 'CONFIRMED'],
        },
        items: {
          some: {
            productId: validatedData.productId,
          },
        },
      },
      select: { id: true },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'You can only review products you have purchased' },
        { status: 403 }
      )
    }

    // Check if user has already reviewed this product
    const existingReview = await prisma.review.findFirst({
      where: {
        productId: validatedData.productId,
        OR: [
          validatedData.customerId ? { customerId: validatedData.customerId } : {},
          { customerEmail: validatedData.customerEmail },
        ].filter(obj => Object.keys(obj).length > 0),
      },
      select: { id: true },
    })

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this product' },
        { status: 409 }
      )
    }

    // Since we verified purchase, mark as verified
    const isVerified = true
    const orderId = validatedData.orderId || purchaseOrder.id

    // Create review
    const review = await prisma.review.create({
      data: {
        productId: validatedData.productId,
        rating: validatedData.rating,
        title: sanitizedTitle,
        comment: sanitizedComment,
        customerName: validatedData.customerName,
        customerEmail: validatedData.customerEmail,
        customerId: validatedData.customerId || null,
        orderId: orderId,
        isVerified,
        images: validatedData.images ? JSON.stringify(validatedData.images) : null,
        status: 'PENDING', // All reviews start as pending for moderation
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    // Award points for leaving a review (if customer is logged in)
    if (validatedData.customerId) {
      try {
        await prisma.pointsTransaction.create({
          data: {
            customerId: validatedData.customerId,
            points: 25, // 25 points for a review
            type: 'REVIEW',
            description: `Review posted for ${product.id}`,
          },
        })

        // Update customer points balance
        await prisma.customer.update({
          where: { id: validatedData.customerId },
          data: {
            currentPoints: {
              increment: 25,
            },
          },
        })
      } catch (error) {
        console.error('Error awarding review points:', error)
        // Don't fail the review creation if points award fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        review: {
          id: review.id,
          rating: review.rating,
          status: review.status,
          isVerified: review.isVerified,
          createdAt: review.createdAt,
        },
        message: 'Review submitted successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      )
    }

    console.error('Review submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    )
  }
}

// GET /api/reviews - List all reviews (admin only)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const { page, limit } = getPaginationParams(searchParams)
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

    return NextResponse.json(
      createPaginatedResponse(reviews, totalCount, page, limit)
    )

  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}
