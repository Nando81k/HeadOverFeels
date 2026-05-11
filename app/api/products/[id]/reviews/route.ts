import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// GET /api/products/[id]/reviews - Get reviews for a specific product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.max(1, Math.min(20, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const sortBy = searchParams.get('sortBy') || 'newest' // newest, oldest, highest, lowest, helpful
    const verified = searchParams.get('verified') // 'true' to filter verified purchases only
    const hasMedia = searchParams.get('hasMedia') // 'true' to filter reviews with photos
    const ratingParam = searchParams.get('rating')
    const rating = ratingParam ? parseInt(ratingParam, 10) : null

    if (ratingParam && (Number.isNaN(rating) || rating === null || rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Invalid rating filter. Must be a number between 1 and 5.' },
        { status: 400 }
      )
    }

    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.ReviewWhereInput = {
      productId,
      status: 'APPROVED' // Only show approved reviews to customers
    }
    
    if (verified === 'true') {
      where.isVerified = true
    }

    if (rating !== null) {
      where.rating = rating
    }

    if (hasMedia === 'true') {
      where.AND = [
        { images: { not: null } },
        { NOT: { images: '' } },
      ]
    }

    // Build orderBy clause
    let orderBy: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[]
    
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' }
    } else if (sortBy === 'highest') {
      orderBy = { rating: 'desc' }
    } else if (sortBy === 'lowest') {
      orderBy = { rating: 'asc' }
    } else if (sortBy === 'helpful') {
      orderBy = [
        { helpfulCount: 'desc' },
        { createdAt: 'desc' }
      ]
    } else { // newest (default)
      orderBy = { createdAt: 'desc' }
    }

    // Fetch reviews and calculate stats
    const [reviews, totalCount, stats] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          images: true,
          customerName: true,
          isVerified: true,
          helpfulCount: true,
          notHelpfulCount: true,
          createdAt: true,
          adminReply: true,
          adminReplyAt: true,
          customer: {
            select: { profilePictureUrl: true },
          },
        }
      }),
      prisma.review.count({ where }),
      prisma.review.groupBy({
        by: ['rating'],
        where: {
          productId,
          status: 'APPROVED'
        },
        _count: {
          rating: true
        }
      })
    ])

    // Calculate average rating and distribution
    const totalReviews = stats.reduce((sum: number, stat: { rating: number; _count: { rating: number } }) => 
      sum + stat._count.rating, 0)
    const averageRating = totalReviews > 0
      ? stats.reduce((sum: number, stat: { rating: number; _count: { rating: number } }) => 
        sum + (stat.rating * stat._count.rating), 0) / totalReviews
      : 0

    // Build rating distribution (1-5 stars)
    const distribution: Record<number, number> = {}
    for (let i = 1; i <= 5; i++) {
      const stat = stats.find((s: { rating: number }) => s.rating === i)
      distribution[i] = stat ? (stat as { _count: { rating: number } })._count.rating : 0
    }

    const totalPages = Math.ceil(totalCount / limit)

    // Flatten customer.profilePictureUrl into top-level field
    const reviewsWithAvatar = reviews.map(({ customer, ...r }) => ({
      ...r,
      profilePictureUrl: customer?.profilePictureUrl ?? null,
    }))

    return NextResponse.json({
      data: reviewsWithAvatar,
      stats: {
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalReviews,
        distribution
      },
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
    console.error('Error fetching product reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product reviews' },
      { status: 500 }
    )
  }
}
