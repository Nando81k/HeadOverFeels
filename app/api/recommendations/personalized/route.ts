import { NextRequest, NextResponse } from 'next/server'
import { getPersonalizedRecommendations } from '@/lib/recommendations/engine'
import { getTrendingProducts } from '@/lib/recommendations/engine'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '8')
    const customerId = searchParams.get('customerId') // In production, get from auth session
    
    let recommendations

    if (customerId) {
      // Get personalized recommendations for authenticated users
      recommendations = await getPersonalizedRecommendations(customerId, {
        limit,
      })
    } else {
      // Fallback to trending products for anonymous users
      recommendations = await getTrendingProducts({ limit })
    }

    // Fetch full product details
    const productIds = recommendations.map(r => r.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
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
        isFeatured: true,
        isFeaturedNewArrival: true,
        isLimitedEdition: true,
        releaseDate: true,
        dropEndDate: true,
      },
    })

    // Combine with scores
    const personalizedProducts = recommendations
      .map(r => {
        const product = products.find(p => p.id === r.productId)
        if (!product) return null
        return {
          ...product,
          recommendationScore: r.score,
          recommendationReason: r.reason,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      data: {
        recommendations: personalizedProducts,
        count: personalizedProducts.length,
        type: customerId ? 'personalized' : 'trending',
        customerId: customerId || null,
      },
    })
  } catch (error) {
    console.error('Error getting personalized recommendations:', error)
    return NextResponse.json(
      {
        error: 'Failed to get personalized recommendations',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
