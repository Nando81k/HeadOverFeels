import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for product updates
const updateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').optional(),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
  compareAtPrice: z.number().optional(),
  images: z.string().optional(),
  materials: z.string().optional(),
  careGuide: z.string().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  categoryId: z.string().optional(),
  collectionIds: z.array(z.string()).optional(),
  variants: z.array(z.object({
    sku: z.string().min(1, 'SKU is required'),
    size: z.string().optional(),
    color: z.string().optional(),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hex must be in format #RRGGBB').optional().or(z.literal('')),
    images: z.string().optional(),
    price: z.number().optional(),
    inventory: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true)
  })).optional()
})

// GET /api/products/[id] - Fetch single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        category: true,
        collections: {
          select: {
            collectionId: true
          }
        },
        _count: {
          select: { 
            variants: true,
            orderItems: true,
            cartItems: true
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

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateProductSchema.parse(body)

    const { collectionIds, variants, ...productData } = validatedData

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Update slug if name is being changed
    const updateData: typeof productData & { slug?: string } = { ...productData }
    if (productData.name && productData.name !== existingProduct.name) {
      const baseSlug = productData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      
      let slug = baseSlug
      let counter = 1

      // Ensure new slug is unique
      while (await prisma.product.findFirst({ 
        where: { 
          slug, 
          id: { not: id } 
        } 
      })) {
        slug = `${baseSlug}-${counter}`
        counter++
      }

      updateData.slug = slug
    }

    // Update product and handle collection associations
    const product = await prisma.$transaction(async (tx) => {
      // Update product data
      await tx.product.update({
        where: { id },
        data: updateData
      })

      // If variants provided, replace all variants
      if (variants !== undefined) {
        // Delete existing variants
        await tx.productVariant.deleteMany({
          where: { productId: id }
        })

        // Create new variants
        if (variants.length > 0) {
          await tx.productVariant.createMany({
            data: variants.map(v => ({
              ...v,
              productId: id,
              // Convert empty string to null for optional fields
              colorHex: v.colorHex || null,
              images: v.images || null,
            }))
          })
        }
      }

      // If collectionIds provided, update collection associations
      if (collectionIds !== undefined) {
        // Remove all existing associations
        await tx.collectionProduct.deleteMany({
          where: { productId: id }
        })

        // Add new associations
        if (collectionIds.length > 0) {
          await tx.collectionProduct.createMany({
            data: collectionIds.map((collectionId, index) => ({
              collectionId,
              productId: id,
              sortOrder: index
            }))
          })
        }
      }

      // Return updated product with collections
      return await tx.product.findUnique({
        where: { id },
        include: {
          variants: true,
          category: true,
          collections: {
            select: {
              collectionId: true
            }
          }
        }
      })
    })

    return NextResponse.json(product)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orderItems: true,
            cartItems: true
          }
        }
      }
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if product has orders (prevent deletion if so)
    if (existingProduct._count.orderItems > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product with existing orders. Consider marking it as inactive instead.' },
        { status: 400 }
      )
    }

    // Delete the product (variants will be cascade deleted)
    await prisma.product.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}