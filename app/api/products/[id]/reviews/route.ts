import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/products/[id]/reviews - Get reviews for a specific product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'newest' // newest, oldest, highest, lowest, helpful
    const verified = searchParams.get('verified') // 'true' to filter verified purchases only

    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {
      productId,
      status: 'APPROVED' // Only show approved reviews to customers
    }
    
    if (verified === 'true') {
      where.isVerified = true
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
          createdAt: true
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

    return NextResponse.json({
      data: reviews,
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
