import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      productId,
      duration = 0,
      source = 'direct',
      sessionId,
      customerId,
    } = body

    // Validate required fields
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get user agent and IP from headers
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Check if this session already viewed this product recently (within last hour)
    // to prevent duplicate tracking
    if (sessionId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const recentView = await prisma.productView.findFirst({
        where: {
          productId,
          sessionId,
          viewedAt: { gte: oneHourAgo },
        },
      })

      if (recentView) {
        return NextResponse.json({
          success: true,
          message: 'View already tracked recently',
          viewId: recentView.id,
        })
      }
    }

    // Create product view record
    const view = await prisma.productView.create({
      data: {
        productId,
        customerId: customerId || null,
        sessionId: sessionId || null,
        duration,
        source,
        userAgent,
        ipAddress,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Product view tracked successfully',
      viewId: view.id,
    })
  } catch (error) {
    console.error('Error tracking product view:', error)
    return NextResponse.json(
      {
        error: 'Failed to track product view',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
