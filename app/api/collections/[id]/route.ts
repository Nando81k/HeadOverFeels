import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for collection update
const updateCollectionSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  productIds: z.array(z.string()).optional(), // Array of product IDs to associate
})

// GET /api/collections/[id] - Get single collection
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              include: {
                variants: true,
                category: true
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
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(collection)
  } catch (error) {
    console.error('Error fetching collection:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection' },
      { status: 500 }
    )
  }
}

// PUT /api/collections/[id] - Update collection
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateCollectionSchema.parse(body)

    const { productIds, ...collectionData } = validatedData

    // Check if collection exists
    const existingCollection = await prisma.collection.findUnique({
      where: { id }
    })

    if (!existingCollection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // If slug is being updated, ensure it's unique
    if (collectionData.slug && collectionData.slug !== existingCollection.slug) {
      const slugExists = await prisma.collection.findUnique({
        where: { slug: collectionData.slug }
      })
      if (slugExists) {
        return NextResponse.json(
          { error: 'Slug already in use' },
          { status: 400 }
        )
      }
    }

    // Update collection and handle product associations
    const collection = await prisma.$transaction(async (tx) => {
      // Update collection data
      const updated = await tx.collection.update({
        where: { id },
        data: collectionData
      })

      // If productIds provided, update product associations
      if (productIds !== undefined) {
        // Remove all existing associations
        await tx.collectionProduct.deleteMany({
          where: { collectionId: id }
        })

        // Add new associations
        if (productIds.length > 0) {
          await tx.collectionProduct.createMany({
            data: productIds.map((productId, index) => ({
              collectionId: id,
              productId,
              sortOrder: index
            }))
          })
        }
      }

      // Return updated collection with products
      return await tx.collection.findUnique({
        where: { id },
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
        }
      })
    })

    return NextResponse.json(collection)
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

    console.error('Error updating collection:', error)
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    )
  }
}

// DELETE /api/collections/[id] - Delete collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if collection exists
    const collection = await prisma.collection.findUnique({
      where: { id }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Delete collection (cascade will handle CollectionProduct)
    await prisma.collection.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting collection:', error)
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    )
  }
}
