import { NextRequest, NextResponse } from 'next/server'
import { NewsletterCampaignStatus } from '@prisma/client'
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

const createCampaignSchema = z.object({
  name: z.string().max(120).optional().nullable(),
  subject: z.string().max(160).optional(),
  preheader: z.string().max(240).optional().nullable(),
  heroImageUrl: z.string().optional().nullable(),
  ctaLabel: z.string().max(80).optional().nullable(),
  ctaUrl: z.string().optional().nullable(),
  bodyMarkdown: z.string().max(12000).optional(),
  audienceFilter: z.unknown().optional(),
})

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback
  }
  return parsed
}

// GET /api/admin/newsletter/campaigns - List campaigns
export async function GET(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parsePositiveInteger(searchParams.get('page'), 1)
    const limit = parsePositiveInteger(searchParams.get('limit'), 20)
    const status = searchParams.get('status') || 'all'

    const where: { status?: NewsletterCampaignStatus } = {}
    const allowedStatuses: NewsletterCampaignStatus[] = ['DRAFT', 'QUEUED', 'SENDING', 'SENT', 'FAILED']
    const campaignDelegate = getRequiredNewsletterCampaignDelegate()

    if (status !== 'all' && allowedStatuses.includes(status as NewsletterCampaignStatus)) {
      where.status = status as NewsletterCampaignStatus
    }

    const skip = (page - 1) * limit

    const [campaigns, total] = await Promise.all([
      campaignDelegate.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip,
        select: {
          id: true,
          name: true,
          subject: true,
          status: true,
          audienceCount: true,
          sentCount: true,
          failedCount: true,
          sentAt: true,
          createdAt: true,
          updatedAt: true,
          createdByAdmin: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          audienceFilter: true,
        },
      }),
      campaignDelegate.count({ where }),
    ])

    return NextResponse.json({
      campaigns: campaigns.map((campaign) => ({
        ...campaign,
        audienceFilter: parseStoredAudienceFilter(campaign.audienceFilter),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (isNewsletterCampaignNotReadyError(error)) {
      return NextResponse.json(
        { error: NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE },
        { status: 503 }
      )
    }

    console.error('Failed to fetch campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

// POST /api/admin/newsletter/campaigns - Create draft campaign
export async function POST(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createCampaignSchema.parse(body)
    const campaignContent = parseCampaignContentInput(parsed)
    const audienceCount = await getAudienceCount(campaignContent.audienceFilter)
    const campaignDelegate = getRequiredNewsletterCampaignDelegate()

    const campaign = await campaignDelegate.create({
      data: {
        name: campaignContent.name,
        subject: campaignContent.subject,
        preheader: campaignContent.preheader,
        heroImageUrl: campaignContent.heroImageUrl,
        ctaLabel: campaignContent.ctaLabel,
        ctaUrl: campaignContent.ctaUrl,
        bodyMarkdown: campaignContent.bodyMarkdown,
        status: 'DRAFT',
        audienceFilter: serializeAudienceFilter(campaignContent.audienceFilter),
        audienceCount,
        createdByAdminId: adminId,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        preheader: true,
        heroImageUrl: true,
        ctaLabel: true,
        ctaUrl: true,
        bodyMarkdown: true,
        status: true,
        audienceFilter: true,
        audienceCount: true,
        sentCount: true,
        failedCount: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
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

    console.error('Failed to create campaign:', error)
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
