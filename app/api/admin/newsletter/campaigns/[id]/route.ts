import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import {
  parseCampaignContentInput,
  parseStoredAudienceFilter,
  serializeAudienceFilter,
} from '@/lib/newsletter/campaigns'
import { getAudienceCount } from '@/lib/newsletter/audience'
import {
  getRequiredNewsletterCampaignDelegate,
  isNewsletterCampaignNotReadyError,
  NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE,
} from '@/lib/newsletter/campaign-delegate'

const patchCampaignSchema = z.object({
  name: z.string().max(120).optional().nullable(),
  subject: z.string().max(160).optional(),
  preheader: z.string().max(240).optional().nullable(),
  heroImageUrl: z.string().optional().nullable(),
  ctaLabel: z.string().max(80).optional().nullable(),
  ctaUrl: z.string().optional().nullable(),
  bodyMarkdown: z.string().max(12000).optional(),
  audienceFilter: z.unknown().optional(),
})

// GET /api/admin/newsletter/campaigns/[id] - Campaign detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const campaignDelegate = getRequiredNewsletterCampaignDelegate()

    const campaign = await campaignDelegate.findUnique({
      where: { id },
      include: {
        createdByAdmin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      campaign: {
        ...campaign,
        audienceFilter: parseStoredAudienceFilter(campaign.audienceFilter),
      },
    })
  } catch (error) {
    if (isNewsletterCampaignNotReadyError(error)) {
      return NextResponse.json(
        { error: NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE },
        { status: 503 }
      )
    }

    console.error('Failed to fetch campaign detail:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/newsletter/campaigns/[id] - Update draft campaign
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = patchCampaignSchema.parse(body)
    const campaignDelegate = getRequiredNewsletterCampaignDelegate()

    const existing = await campaignDelegate.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        name: true,
        subject: true,
        preheader: true,
        heroImageUrl: true,
        ctaLabel: true,
        ctaUrl: true,
        bodyMarkdown: true,
        audienceFilter: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft campaigns can be edited' },
        { status: 400 }
      )
    }

    const mergedPayload = {
      name: parsed.name ?? existing.name,
      subject: parsed.subject ?? existing.subject,
      preheader: parsed.preheader ?? existing.preheader,
      heroImageUrl: parsed.heroImageUrl ?? existing.heroImageUrl,
      ctaLabel: parsed.ctaLabel ?? existing.ctaLabel,
      ctaUrl: parsed.ctaUrl ?? existing.ctaUrl,
      bodyMarkdown: parsed.bodyMarkdown ?? existing.bodyMarkdown,
      audienceFilter: parsed.audienceFilter ?? parseStoredAudienceFilter(existing.audienceFilter),
    }

    const campaignContent = parseCampaignContentInput(mergedPayload)
    const audienceCount = await getAudienceCount(campaignContent.audienceFilter)

    const campaign = await campaignDelegate.update({
      where: { id },
      data: {
        name: campaignContent.name,
        subject: campaignContent.subject,
        preheader: campaignContent.preheader,
        heroImageUrl: campaignContent.heroImageUrl,
        ctaLabel: campaignContent.ctaLabel,
        ctaUrl: campaignContent.ctaUrl,
        bodyMarkdown: campaignContent.bodyMarkdown,
        audienceFilter: serializeAudienceFilter(campaignContent.audienceFilter),
        audienceCount,
      },
    })

    return NextResponse.json({
      campaign: {
        ...campaign,
        audienceFilter: parseStoredAudienceFilter(campaign.audienceFilter),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid campaign payload', details: error.issues },
        { status: 400 }
      )
    }

    if (isNewsletterCampaignNotReadyError(error)) {
      return NextResponse.json(
        { error: NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE },
        { status: 503 }
      )
    }

    console.error('Failed to update campaign:', error)
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    )
  }
}
