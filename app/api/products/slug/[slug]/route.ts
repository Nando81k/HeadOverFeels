import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/products/slug/[slug] - Fetch product by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const now = new Date()
    
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        variants: true,
        category: true,
        collections: {
          include: {
            collection: true
          }
        }
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if this is an upcoming limited drop (not yet released)
    if (product.isLimitedEdition && product.releaseDate) {
      const releaseDate = new Date(product.releaseDate)
      if (releaseDate > now) {
        // Don't show upcoming limited drops on product pages
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product by slug:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}
