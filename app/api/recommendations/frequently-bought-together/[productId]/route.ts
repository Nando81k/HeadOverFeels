import { NextRequest, NextResponse } from 'next/server'
import { getFrequentlyBoughtTogether } from '@/lib/recommendations/engine'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '4')

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get frequently bought together products
    const frequentlyBought = await getFrequentlyBoughtTogether(productId, {
      limit,
    })

    // Fetch full product details
    const productIds = frequentlyBought.map(f => f.productId)
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

    // Combine with scores
    const recommendations = frequentlyBought
      .map(f => {
        const prod = products.find(p => p.id === f.productId)
        if (!prod) return null
        return {
          ...prod,
          coOccurrenceScore: f.score,
          bundleReason: f.reason,
        }
      })
      .filter(Boolean)

    // Calculate bundle pricing
    const bundlePrice = recommendations.reduce(
      (sum, rec) => sum + (rec?.price || 0),
      product.price
    )
    const bundleDiscount = bundlePrice * 0.1 // 10% bundle discount
    const bundleFinalPrice = bundlePrice - bundleDiscount

    return NextResponse.json({
      success: true,
      data: {
        sourceProduct: {
          id: product.id,
          name: product.name,
          price: product.price,
        },
        recommendations,
        count: recommendations.length,
        bundlePricing: {
          originalPrice: bundlePrice,
          discount: bundleDiscount,
          finalPrice: bundleFinalPrice,
          savings: bundleDiscount,
          savingsPercentage: 10,
        },
      },
    })
  } catch (error) {
    console.error('Error getting frequently bought together:', error)
    return NextResponse.json(
      {
        error: 'Failed to get frequently bought together',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
