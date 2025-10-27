import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for restock request
const restockSchema = z.object({
  variants: z.array(
    z.object({
      id: z.string(),
      inventory: z.number().int().min(0),
    })
  ),
  notes: z.string().optional(),
})

// PATCH /api/products/[id]/restock - Update variant inventory
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = restockSchema.parse(body)

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Verify all variant IDs belong to this product
    const productVariantIds = new Set(product.variants.map((v) => v.id))
    const invalidVariants = validatedData.variants.filter(
      (v) => !productVariantIds.has(v.id)
    )

    if (invalidVariants.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid variant IDs',
          details: invalidVariants.map((v) => v.id),
        },
        { status: 400 }
      )
    }

    // Update inventory for each variant in a transaction
    await prisma.$transaction(
      validatedData.variants.map((update) =>
        prisma.productVariant.update({
          where: { id: update.id },
          data: { inventory: update.inventory },
        })
      )
    )

    // Optional: Log restock activity (if you add a RestockLog model)
    // await prisma.restockLog.create({
    //   data: {
    //     productId: id,
    //     notes: validatedData.notes,
    //     changes: JSON.stringify(validatedData.variants),
    //   },
    // })

    // Return updated product with variants
    const updatedProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        category: true,
      },
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error restocking product:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory' },
      { status: 500 }
    )
  }
}
