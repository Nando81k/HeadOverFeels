import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// GET /api/products/search - Search products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const query = searchParams.get('q') || ''
    const category = searchParams.get('category')
    const minPrice = searchParams.get('minPrice') 
      ? parseFloat(searchParams.get('minPrice')!) 
      : undefined
    const maxPrice = searchParams.get('maxPrice') 
      ? parseFloat(searchParams.get('maxPrice')!) 
      : undefined
    const sortBy = searchParams.get('sortBy') || 'relevance'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const isLimitedEdition = searchParams.get('isLimitedEdition') === 'true'
    
    // Build where clause for search
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    }

    // Text search across name and description
    if (query) {
      const searchTerm = query.toLowerCase()
      where.OR = [
        {
          name: {
            contains: searchTerm,
          },
        },
        {
          description: {
            contains: searchTerm,
          },
        },
      ]
    }

    // Category filter
    if (category) {
      where.category = {
        slug: category,
      }
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {}
      if (minPrice !== undefined) {
        where.price.gte = minPrice
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice
      }
    }

    // Limited edition filter
    if (isLimitedEdition) {
      where.isLimitedEdition = true
    }

    // Determine sort order
    let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] = {}
    switch (sortBy) {
      case 'price-asc':
        orderBy = { price: 'asc' }
        break
      case 'price-desc':
        orderBy = { price: 'desc' }
        break
      case 'name-asc':
        orderBy = { name: 'asc' }
        break
      case 'name-desc':
        orderBy = { name: 'desc' }
        break
      case 'newest':
        orderBy = { createdAt: 'desc' }
        break
      case 'oldest':
        orderBy = { createdAt: 'asc' }
        break
      case 'relevance':
      default:
        // For relevance, prioritize exact matches in name, then description
        // This is a simple implementation - could be enhanced with scoring
        orderBy = [
          { isFeatured: 'desc' },
          { createdAt: 'desc' },
        ]
        break
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Execute search query
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          variants: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              inventory: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ])

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      query: {
        q: query,
        category,
        minPrice,
        maxPrice,
        sortBy,
        isLimitedEdition,
      },
    })
  } catch (error) {
    console.error('Product search error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to search products',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
