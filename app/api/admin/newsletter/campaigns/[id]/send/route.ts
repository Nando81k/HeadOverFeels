import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { queueCampaignForSend } from '@/lib/newsletter/campaigns'
import {
  isNewsletterCampaignNotReadyError,
  NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE,
} from '@/lib/newsletter/campaign-delegate'

// POST /api/admin/newsletter/campaigns/[id]/send
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const result = await queueCampaignForSend(id)

    return NextResponse.json({
      success: true,
      campaign: result,
      message: 'Campaign queued for dispatch.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send campaign'

    if (isNewsletterCampaignNotReadyError(error)) {
      return NextResponse.json(
        { error: NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE },
        { status: 503 }
      )
    }

    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      )
    }

    if (message.toLowerCase().includes('only draft') || message.toLowerCase().includes('only queued')) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      )
    }

    if (
      message.toLowerCase().includes('already being sent') ||
      message.toLowerCase().includes('already queued')
    ) {
      return NextResponse.json(
        { error: message },
        { status: 409 }
      )
    }

    console.error('Failed to send newsletter campaign:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
