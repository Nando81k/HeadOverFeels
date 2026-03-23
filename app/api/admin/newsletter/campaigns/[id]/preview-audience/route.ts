import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/admin'
import { resolveAudienceRecipients } from '@/lib/newsletter/audience'
import {
  getRequiredNewsletterCampaignDelegate,
  isNewsletterCampaignNotReadyError,
  NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE,
} from '@/lib/newsletter/campaign-delegate'

async function previewAudienceForCampaign(
  request: NextRequest,
  params: Promise<{ id: string }>,
  audienceFilterOverride?: unknown
) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const campaignDelegate = getRequiredNewsletterCampaignDelegate()

  const campaign = await campaignDelegate.findUnique({
    where: { id },
    select: {
      id: true,
      audienceFilter: true,
    },
  })

  if (!campaign) {
    return NextResponse.json(
      { error: 'Campaign not found' },
      { status: 404 }
    )
  }

  const { filter, recipients } = await resolveAudienceRecipients(
    audienceFilterOverride ?? campaign.audienceFilter
  )

  return NextResponse.json({
    estimatedRecipients: recipients.length,
    filter,
    sampleRecipients: recipients.slice(0, 5).map((recipient) => recipient.email),
  })
}

// GET /api/admin/newsletter/campaigns/[id]/preview-audience
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return previewAudienceForCampaign(request, params)
  } catch (error) {
    if (isNewsletterCampaignNotReadyError(error)) {
      return NextResponse.json(
        { error: NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE },
        { status: 503 }
      )
    }

    console.error('Failed to preview campaign audience:', error)
    return NextResponse.json(
      { error: 'Failed to preview audience' },
      { status: 500 }
    )
  }
}

// POST /api/admin/newsletter/campaigns/[id]/preview-audience
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({}))
    return previewAudienceForCampaign(request, params, body.audienceFilter)
  } catch (error) {
    if (isNewsletterCampaignNotReadyError(error)) {
      return NextResponse.json(
        { error: NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE },
        { status: 503 }
      )
    }

    console.error('Failed to preview campaign audience:', error)
    return NextResponse.json(
      { error: 'Failed to preview audience' },
      { status: 500 }
    )
  }
}
