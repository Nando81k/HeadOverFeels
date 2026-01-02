import { NextRequest, NextResponse } from 'next/server'
import { getSimilarProducts } from '@/lib/recommendations/engine'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '6')
    const minScore = parseFloat(searchParams.get('minScore') || '0.3')

    // Verify product exists
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

    // Get similar products
    const similar = await getSimilarProducts(productId, {
      limit,
      minScore,
    })

    // Fetch full product details for each recommendation
    const productIds = similar.map(s => s.productId)
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
      },
    })

    // Combine with scores and sort by score
    const recommendations = similar
      .map(s => {
        const product = products.find(p => p.id === s.productId)
        if (!product) return null
        return {
          ...product,
          recommendationScore: s.score,
          recommendationReason: s.reason,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      data: {
        sourceProduct: {
          id: product.id,
          name: product.name,
        },
        recommendations,
        count: recommendations.length,
      },
    })
  } catch (error) {
    console.error('Error getting similar products:', error)
    return NextResponse.json(
      {
        error: 'Failed to get similar products',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
