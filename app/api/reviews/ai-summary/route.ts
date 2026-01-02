import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateReviewSummary } from '@/lib/ai/review-summary'

// GET /api/reviews/ai-summary?productId=xxx - Get AI summary of reviews for a product
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Fetch all approved reviews for this product
    const reviews = await prisma.review.findMany({
      where: {
        productId,
        status: 'APPROVED',
      },
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        customerName: true,
        isVerified: true,
        helpfulCount: true,
        createdAt: true,
      },
      orderBy: [
        { helpfulCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 50, // Limit to most recent/helpful reviews
    })

    // Need at least 3 reviews for a meaningful summary
    if (reviews.length < 3) {
      return NextResponse.json({
        hasSummary: false,
        message: 'Not enough reviews for AI summary',
        reviewCount: reviews.length,
      })
    }

    // Calculate stats
    const averageRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    }

    // Generate AI summary
    const summary = await generateReviewSummary({
      productName: product.name,
      reviews: reviews.map(r => ({
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        customerName: r.customerName,
        isVerified: r.isVerified,
      })),
      averageRating,
      totalReviews: reviews.length,
    })

    return NextResponse.json({
      hasSummary: true,
      summary,
      stats: {
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews: reviews.length,
        ratingDistribution,
        verifiedCount: reviews.filter(r => r.isVerified).length,
      },
    })

  } catch (error) {
    console.error('AI review summary error:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI summary' },
      { status: 500 }
    )
  }
}
