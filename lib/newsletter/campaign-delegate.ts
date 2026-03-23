import { prisma } from '@/lib/prisma'

export const NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE =
  'Newsletter campaigns are not ready yet. Run `npx prisma db push && npx prisma generate`, then restart the server.'

type NewsletterCampaignDelegate = typeof prisma.newsletterCampaign
type NewsletterCampaignDeliveryDelegate = typeof prisma.newsletterCampaignDelivery

function readDelegate<T>(key: 'newsletterCampaign' | 'newsletterCampaignDelivery'): T | null {
  const value = (prisma as unknown as Record<string, unknown>)[key] as T | undefined
  return value || null
}

export function getNewsletterCampaignDelegate(): NewsletterCampaignDelegate | null {
  return readDelegate<NewsletterCampaignDelegate>('newsletterCampaign')
}

export function getRequiredNewsletterCampaignDelegate(): NewsletterCampaignDelegate {
  const delegate = getNewsletterCampaignDelegate()
  if (!delegate) {
    throw new Error(NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE)
  }
  return delegate
}

export function getRequiredNewsletterCampaignDeliveryDelegate(): NewsletterCampaignDeliveryDelegate {
  const delegate = readDelegate<NewsletterCampaignDeliveryDelegate>('newsletterCampaignDelivery')
  if (!delegate) {
    throw new Error(NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE)
  }
  return delegate
}

export function isNewsletterCampaignNotReadyError(error: unknown): boolean {
  return error instanceof Error && error.message === NEWSLETTER_CAMPAIGN_NOT_READY_MESSAGE
}
