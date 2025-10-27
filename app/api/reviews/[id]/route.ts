import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/reviews/[id] - Get a specific review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: true
          }
        },
        customer: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      }
    })

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: review })

  } catch (error) {
    console.error('Error fetching review:', error)
    return NextResponse.json(
      { error: 'Failed to fetch review' },
      { status: 500 }
    )
  }
}

// PATCH /api/reviews/[id] - Update review (admin moderation)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      status,
      rejectionReason,
      moderatedBy,
      adminReply,
      adminReplyBy
    } = body

    // Check if review exists
    const existingReview = await prisma.review.findUnique({
      where: { id }
    })

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      )
    }

    // Update review
    const updateData: Record<string, unknown> = {}
    
    if (status) {
      updateData.status = status
      updateData.moderatedAt = new Date()
      if (moderatedBy) {
        updateData.moderatedBy = moderatedBy
      }
    }
    
    if (status === 'REJECTED' && rejectionReason) {
      updateData.rejectionReason = rejectionReason
    }

    // Handle admin reply
    if (adminReply !== undefined) {
      updateData.adminReply = adminReply || null
      updateData.adminReplyAt = adminReply ? new Date() : null
      if (adminReply && adminReplyBy) {
        updateData.adminReplyBy = adminReplyBy
      } else if (!adminReply) {
        updateData.adminReplyBy = null
      }
    }

    const review = await prisma.review.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })

    return NextResponse.json({
      data: review,
      message: 'Review updated successfully'
    })

  } catch (error) {
    console.error('Error updating review:', error)
    return NextResponse.json(
      { error: 'Failed to update review' },
      { status: 500 }
    )
  }
}

// DELETE /api/reviews/[id] - Delete a review (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if review exists
    const existingReview = await prisma.review.findUnique({
      where: { id }
    })

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      )
    }

    // Delete review
    await prisma.review.delete({
      where: { id }
    })

    return NextResponse.json({
      message: 'Review deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting review:', error)
    return NextResponse.json(
      { error: 'Failed to delete review' },
      { status: 500 }
    )
  }
}
