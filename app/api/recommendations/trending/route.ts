import { NextRequest, NextResponse } from 'next/server'
import { getTrendingProducts } from '@/lib/recommendations/engine'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '8')
    const categoryId = searchParams.get('categoryId') || undefined

    // Get trending products
    const trending = await getTrendingProducts({ limit })

    // Fetch full product details
    const productIds = trending.map(t => t.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        ...(categoryId && { categoryId }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        compareAtPrice: true,
        images: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            size: true,
            color: true,
            inventory: true,
          },
        },
        isLimitedEdition: true,
        releaseDate: true,
        dropEndDate: true,
        maxQuantity: true,
      },
    })

    // Combine with trending scores
    const recommendations = trending
      .map(t => {
        const product = products.find(p => p.id === t.productId)
        if (!product) return null
        return {
          ...product,
          trendingScore: t.score,
          trendingReason: t.reason,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
        period: '7 days',
      },
    })
  } catch (error) {
    console.error('Error getting trending products:', error)
    return NextResponse.json(
      {
        error: 'Failed to get trending products',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
