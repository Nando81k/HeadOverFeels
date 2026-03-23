import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import {
  pickCampaignContent,
  sendCampaignTestEmail,
} from '@/lib/newsletter/campaigns'
import { normalizeNewsletterEmail } from '@/lib/newsletter/types'
import {
  getRequiredNewsletterCampaignDelegate,
  getRequiredNewsletterCampaignDeliveryDelegate,
  isNewsletterCampaignNotReadyError,
  NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE,
} from '@/lib/newsletter/campaign-delegate'

const sendTestSchema = z.object({
  email: z.string().email('Valid test email is required'),
})

// POST /api/admin/newsletter/campaigns/[id]/send-test
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
    const body = await request.json()
    const { email } = sendTestSchema.parse(body)
    const normalizedEmail = normalizeNewsletterEmail(email)
    const campaignDelegate = getRequiredNewsletterCampaignDelegate()
    const deliveryDelegate = getRequiredNewsletterCampaignDeliveryDelegate()

    const campaign = await campaignDelegate.findUnique({
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

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft campaigns can send test emails' },
        { status: 400 }
      )
    }

    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
      },
    })

    const campaignContent = pickCampaignContent(campaign)
    const sendResult = await sendCampaignTestEmail(campaignContent, normalizedEmail)

    await deliveryDelegate.upsert({
      where: {
        campaignId_email_isTest: {
          campaignId: campaign.id,
          email: normalizedEmail,
          isTest: true,
        },
      },
      create: {
        campaignId: campaign.id,
        subscriberId: subscriber?.id || null,
        email: normalizedEmail,
        status: sendResult.success ? 'SENT' : 'FAILED',
        providerMessageId: sendResult.messageId,
        errorMessage: sendResult.error,
        sentAt: sendResult.success ? new Date() : null,
        isTest: true,
      },
      update: {
        subscriberId: subscriber?.id || null,
        status: sendResult.success ? 'SENT' : 'FAILED',
        providerMessageId: sendResult.messageId,
        errorMessage: sendResult.error,
        sentAt: sendResult.success ? new Date() : null,
      },
    })

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || 'Failed to send test email' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${normalizedEmail}`,
      messageId: sendResult.messageId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid test email' },
        { status: 400 }
      )
    }

    if (isNewsletterCampaignNotReadyError(error)) {
      return NextResponse.json(
        { error: NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE },
        { status: 503 }
      )
    }

    console.error('Failed to send test campaign email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}
