import { NewsletterCampaign, Prisma } from '@prisma/client'
import { sendNewsletterEmail } from '@/lib/email/newsletter'
import { resolveAudienceRecipients } from '@/lib/newsletter/audience'
import {
  DEFAULT_NEWSLETTER_AUDIENCE_FILTER,
  NewsletterAudienceFilter,
  normalizeAudienceFilter,
  normalizeNewsletterEmail,
} from '@/lib/newsletter/types'
import {
  getRequiredNewsletterCampaignDelegate,
  getRequiredNewsletterCampaignDeliveryDelegate,
} from '@/lib/newsletter/campaign-delegate'

const CAMPAIGN_BATCH_SIZE = 30
const STALE_SENDING_WINDOW_MS = 20 * 60 * 1000
const DEFAULT_QUEUE_PICKUP_LIMIT = 3

export interface NewsletterCampaignContent {
  name: string | null
  subject: string
  preheader: string | null
  heroImageUrl: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  bodyMarkdown: string
  audienceFilter: NewsletterAudienceFilter
}

export interface DispatchCampaignResult {
  audienceCount: number
  sentCount: number
  failedCount: number
  status: 'SENT' | 'FAILED'
}

export interface QueueCampaignResult {
  campaignId: string
  status: 'QUEUED'
}

export interface CampaignDispatchWorkerResult {
  staleRecovered: number
  queuedFound: number
  processed: number
  succeeded: number
  failed: number
  results: Array<{
    campaignId: string
    status: 'SENT' | 'FAILED'
    audienceCount: number
    sentCount: number
    failedCount: number
  }>
}

function sanitizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeOptionalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  if (value.startsWith('/')) {
    return value
  }

  try {
    const parsed = new URL(value)
    return parsed.toString()
  } catch {
    return null
  }
}

export function parseCampaignContentInput(input: unknown): NewsletterCampaignContent {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>

  return {
    name: sanitizeOptionalText(raw.name),
    subject: sanitizeOptionalText(raw.subject) || 'Newsletter Update',
    preheader: sanitizeOptionalText(raw.preheader),
    heroImageUrl: sanitizeOptionalUrl(raw.heroImageUrl),
    ctaLabel: sanitizeOptionalText(raw.ctaLabel),
    ctaUrl: sanitizeOptionalUrl(raw.ctaUrl),
    bodyMarkdown: sanitizeOptionalText(raw.bodyMarkdown) || 'Thanks for being part of Head Over Feels.',
    audienceFilter: normalizeAudienceFilter(raw.audienceFilter),
  }
}

export function parseStoredAudienceFilter(input: Prisma.JsonValue | null): NewsletterAudienceFilter {
  return normalizeAudienceFilter(input ?? DEFAULT_NEWSLETTER_AUDIENCE_FILTER)
}

export function serializeAudienceFilter(filter: NewsletterAudienceFilter): Prisma.InputJsonValue {
  return {
    activeOnly: filter.activeOnly,
    source: filter.source,
    signupDateFrom: filter.signupDateFrom,
    signupDateTo: filter.signupDateTo,
    customerMode: filter.customerMode,
  }
}

export function pickCampaignContent(campaign: Pick<NewsletterCampaign, 'name' | 'subject' | 'preheader' | 'heroImageUrl' | 'ctaLabel' | 'ctaUrl' | 'bodyMarkdown' | 'audienceFilter'>): NewsletterCampaignContent {
  return {
    name: campaign.name,
    subject: campaign.subject,
    preheader: campaign.preheader,
    heroImageUrl: campaign.heroImageUrl,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    bodyMarkdown: campaign.bodyMarkdown,
    audienceFilter: parseStoredAudienceFilter(campaign.audienceFilter),
  }
}

export async function sendCampaignTestEmail(campaign: NewsletterCampaignContent, email: string) {
  return sendNewsletterEmail({
    subject: campaign.subject,
    preheader: campaign.preheader,
    heroImageUrl: campaign.heroImageUrl,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    bodyMarkdown: campaign.bodyMarkdown,
    recipientEmail: normalizeNewsletterEmail(email),
    testMode: true,
  })
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

export async function queueCampaignForSend(campaignId: string): Promise<QueueCampaignResult> {
  const campaignDelegate = getRequiredNewsletterCampaignDelegate()
  const campaign = await campaignDelegate.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      status: true,
    },
  })

  if (!campaign) {
    throw new Error('Campaign not found')
  }

  if (campaign.status !== 'DRAFT') {
    if (campaign.status === 'QUEUED') {
      throw new Error('Campaign is already queued')
    }
    if (campaign.status === 'SENDING') {
      throw new Error('Campaign is already being sent')
    }
    throw new Error('Only draft campaigns can be queued')
  }

  const queued = await campaignDelegate.updateMany({
    where: {
      id: campaignId,
      status: 'DRAFT',
    },
    data: {
      status: 'QUEUED',
      sentAt: null,
    },
  })

  if (queued.count === 0) {
    throw new Error('Campaign is already queued')
  }

  return {
    campaignId,
    status: 'QUEUED',
  }
}

export async function dispatchCampaign(campaignId: string): Promise<DispatchCampaignResult> {
  const campaignDelegate = getRequiredNewsletterCampaignDelegate()
  const deliveryDelegate = getRequiredNewsletterCampaignDeliveryDelegate()
  const campaign = await campaignDelegate.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      status: true,
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
    throw new Error('Campaign not found')
  }

  if (campaign.status !== 'QUEUED') {
    throw new Error('Only queued campaigns can be dispatched')
  }

  const lock = await campaignDelegate.updateMany({
    where: {
      id: campaignId,
      status: 'QUEUED',
    },
    data: {
      status: 'SENDING',
    },
  })

  if (lock.count === 0) {
    throw new Error('Campaign is already being sent')
  }

  let sentCount = 0
  let failedCount = 0
  let audienceCount = 0

  try {
    const { recipients, filter } = await resolveAudienceRecipients(campaign.audienceFilter)
    audienceCount = recipients.length

    const batches = chunkArray(recipients, CAMPAIGN_BATCH_SIZE)

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (recipient) => {
          const result = await sendNewsletterEmail({
            subject: campaign.subject,
            preheader: campaign.preheader,
            heroImageUrl: campaign.heroImageUrl,
            ctaLabel: campaign.ctaLabel,
            ctaUrl: campaign.ctaUrl,
            bodyMarkdown: campaign.bodyMarkdown,
            recipientEmail: recipient.email,
          })

          await deliveryDelegate.upsert({
            where: {
              campaignId_email_isTest: {
                campaignId,
                email: recipient.email,
                isTest: false,
              },
            },
            create: {
              campaignId,
              subscriberId: recipient.subscriberId,
              email: recipient.email,
              status: result.success ? 'SENT' : 'FAILED',
              providerMessageId: result.messageId,
              errorMessage: result.error,
              sentAt: result.success ? new Date() : null,
              isTest: false,
            },
            update: {
              subscriberId: recipient.subscriberId,
              status: result.success ? 'SENT' : 'FAILED',
              providerMessageId: result.messageId,
              errorMessage: result.error,
              sentAt: result.success ? new Date() : null,
            },
          })

          return result
        })
      )

      for (const result of batchResults) {
        if (result.success) {
          sentCount += 1
        } else {
          failedCount += 1
        }
      }
    }

    const finalStatus = failedCount > 0 ? 'FAILED' : 'SENT'

    await campaignDelegate.update({
      where: { id: campaignId },
      data: {
        status: finalStatus,
        audienceCount,
        sentCount,
        failedCount,
        sentAt: sentCount > 0 ? new Date() : null,
        audienceFilter: serializeAudienceFilter(filter),
      },
    })

    return {
      audienceCount,
      sentCount,
      failedCount,
      status: finalStatus,
    }
  } catch (error) {
    await campaignDelegate.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        audienceCount,
        sentCount,
        failedCount,
      },
    })

    throw error
  }
}

export async function recoverStaleSendingCampaigns(
  staleWindowMs = STALE_SENDING_WINDOW_MS
): Promise<number> {
  const campaignDelegate = getRequiredNewsletterCampaignDelegate()
  const staleBefore = new Date(Date.now() - Math.max(staleWindowMs, 60_000))

  const recovered = await campaignDelegate.updateMany({
    where: {
      status: 'SENDING',
      updatedAt: {
        lt: staleBefore,
      },
    },
    data: {
      status: 'QUEUED',
    },
  })

  return recovered.count
}

export async function processQueuedCampaigns(
  options?: {
    limit?: number
    staleWindowMs?: number
  }
): Promise<CampaignDispatchWorkerResult> {
  const campaignDelegate = getRequiredNewsletterCampaignDelegate()
  const limit = Math.min(Math.max(options?.limit || DEFAULT_QUEUE_PICKUP_LIMIT, 1), 10)
  const staleRecovered = await recoverStaleSendingCampaigns(options?.staleWindowMs)

  const queuedCampaigns = await campaignDelegate.findMany({
    where: {
      status: 'QUEUED',
    },
    orderBy: [
      { updatedAt: 'asc' },
      { createdAt: 'asc' },
    ],
    take: limit,
    select: {
      id: true,
    },
  })

  const results: CampaignDispatchWorkerResult['results'] = []
  let succeeded = 0
  let failed = 0

  for (const campaign of queuedCampaigns) {
    try {
      const dispatched = await dispatchCampaign(campaign.id)
      succeeded += 1
      results.push({
        campaignId: campaign.id,
        ...dispatched,
      })
    } catch (error) {
      failed += 1
      console.error(`Failed to dispatch queued campaign ${campaign.id}:`, error)
    }
  }

  return {
    staleRecovered,
    queuedFound: queuedCampaigns.length,
    processed: succeeded + failed,
    succeeded,
    failed,
    results,
  }
}
