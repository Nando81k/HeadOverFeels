import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CanReviewSchema = z.object({
  productId: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerId: z.string().optional(),
})

// POST /api/reviews/can-review - Check if user can review a product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, customerEmail, customerId } = CanReviewSchema.parse(body)

    // Must have either email or customerId
    if (!customerEmail && !customerId) {
      return NextResponse.json({
        canReview: false,
        reason: 'no_identifier',
        message: 'Please sign in or provide your email to check purchase status',
      })
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    })

    if (!product) {
      return NextResponse.json({
        canReview: false,
        reason: 'product_not_found',
        message: 'Product not found',
      })
    }

    // Check if user has purchased this product (completed order)
    const purchaseOrder = await prisma.order.findFirst({
      where: {
        OR: [
          customerId ? { customerId } : {},
          customerEmail ? { customerEmail } : {},
        ].filter(obj => Object.keys(obj).length > 0),
        status: {
          in: ['DELIVERED', 'SHIPPED', 'PROCESSING', 'CONFIRMED'],
        },
        items: {
          some: {
            productId,
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        items: {
          where: { productId },
          select: {
            productName: true,
            variantDetails: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json({
        canReview: false,
        reason: 'no_purchase',
        message: 'You can only review products you have purchased',
      })
    }

    // Check if user has already reviewed this product
    const existingReview = await prisma.review.findFirst({
      where: {
        productId,
        OR: [
          customerId ? { customerId } : {},
          customerEmail ? { customerEmail } : {},
        ].filter(obj => Object.keys(obj).length > 0),
      },
      select: { id: true, status: true },
    })

    if (existingReview) {
      return NextResponse.json({
        canReview: false,
        reason: 'already_reviewed',
        message: 'You have already reviewed this product',
        existingReviewId: existingReview.id,
        reviewStatus: existingReview.status,
      })
    }

    // User can review
    return NextResponse.json({
      canReview: true,
      orderId: purchaseOrder.id,
      orderNumber: purchaseOrder.orderNumber,
      purchasedItem: purchaseOrder.items[0],
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { canReview: false, reason: 'validation_error', message: 'Invalid request data' },
        { status: 400 }
      )
    }

    console.error('Can review check error:', error)
    return NextResponse.json(
      { canReview: false, reason: 'server_error', message: 'Failed to check review eligibility' },
      { status: 500 }
    )
  }
}
