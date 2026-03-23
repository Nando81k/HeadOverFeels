import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import {
  normalizeCollectionFeaturedFilter,
  normalizeCollectionListSortBy,
} from '@/lib/collections/public-collections'

// Helper function to create slug from name
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Validation schema for collection creation
const createCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required'),
  slug: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

// GET /api/collections - Fetch all collections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isActiveParam = searchParams.get('isActive')
    const isFeaturedParam = searchParams.get('isFeatured')
    const featuredFilter = normalizeCollectionFeaturedFilter(searchParams.get('featured'))
    const sortBy = normalizeCollectionListSortBy(searchParams.get('sortBy'))
    const search = searchParams.get('search')?.trim() ?? ''

    if (search.length > 120) {
      return NextResponse.json(
        { error: 'Search query is too long' },
        { status: 400 }
      )
    }

    const where: Prisma.CollectionWhereInput = {}

    if (isActiveParam !== null) {
      where.isActive = isActiveParam === 'true'
    }

    if (isFeaturedParam !== null) {
      where.isFeatured = isFeaturedParam === 'true'
    } else if (featuredFilter === 'featured') {
      where.isFeatured = true
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    let orderBy: Prisma.CollectionOrderByWithRelationInput[] = [
      { sortOrder: 'asc' },
      { createdAt: 'desc' },
    ]

    if (sortBy === 'name') {
      orderBy = [
        { name: 'asc' },
        { sortOrder: 'asc' },
      ]
    } else if (sortBy === 'productCount') {
      orderBy = [
        { products: { _count: 'desc' } },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ]
    }

    const collections = await prisma.collection.findMany({
      where,
      include: {
        products: {
          include: {
            product: {
              include: {
                variants: true
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          }
        },
        _count: {
          select: { products: true }
        }
      },
      orderBy
    })

    return NextResponse.json(collections)
  } catch (error) {
    console.error('Error fetching collections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    )
  }
}

// POST /api/collections - Create new collection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createCollectionSchema.parse(body)

    // Generate slug if not provided
    const baseSlug = validatedData.slug || createSlug(validatedData.name)
    let slug = baseSlug
    let counter = 1

    // Ensure slug is unique
    while (await prisma.collection.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    const collection = await prisma.collection.create({
      data: {
        ...validatedData,
        slug
      },
      include: {
        _count: {
          select: { products: true }
        }
      }
    })

    return NextResponse.json(collection, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.issues.map(err => ({
            message: err.message,
            path: err.path
          }))
        },
        { status: 400 }
      )
    }

    console.error('Error creating collection:', error)
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    )
  }
}
