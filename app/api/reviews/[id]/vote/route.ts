import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const VoteSchema = z.object({
  voteType: z.enum(['helpful', 'not_helpful']),
})

// POST /api/reviews/[id]/vote - Vote on a review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const { voteType } = VoteSchema.parse(body)

    // Check if review exists
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, helpfulCount: true, notHelpfulCount: true },
    })

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      )
    }

    // Update the vote count
    const updatedReview = await prisma.review.update({
      where: { id },
      data: voteType === 'helpful'
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } },
      select: {
        id: true,
        helpfulCount: true,
        notHelpfulCount: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedReview,
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid vote type', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Vote error:', error)
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    )
  }
}
