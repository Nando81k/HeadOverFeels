export type NewsletterCampaignStatus = 'DRAFT' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED'

export type NewsletterDeliveryStatus = 'SENT' | 'FAILED'

export type NewsletterCustomerMode = 'all' | 'customer' | 'subscriber'

export interface NewsletterAudienceFilter {
  activeOnly: boolean
  source: string | null
  signupDateFrom: string | null
  signupDateTo: string | null
  customerMode: NewsletterCustomerMode
}

export interface NewsletterRecipient {
  subscriberId: string
  email: string
  source: string | null
  createdAt: Date
  isCustomer: boolean
}

export const DEFAULT_NEWSLETTER_AUDIENCE_FILTER: NewsletterAudienceFilter = {
  activeOnly: true,
  source: null,
  signupDateFrom: null,
  signupDateTo: null,
  customerMode: 'all',
}

export function normalizeNewsletterEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeDateValue(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

export function normalizeAudienceFilter(input: unknown): NewsletterAudienceFilter {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_NEWSLETTER_AUDIENCE_FILTER }
  }

  const raw = input as Record<string, unknown>
  const rawCustomerMode = typeof raw.customerMode === 'string' ? raw.customerMode : ''

  const customerMode: NewsletterCustomerMode =
    rawCustomerMode === 'customer' || rawCustomerMode === 'subscriber' ? rawCustomerMode : 'all'

  const source = typeof raw.source === 'string' && raw.source.trim() ? raw.source.trim() : null

  return {
    activeOnly: typeof raw.activeOnly === 'boolean' ? raw.activeOnly : true,
    source,
    signupDateFrom: normalizeDateValue(raw.signupDateFrom),
    signupDateTo: normalizeDateValue(raw.signupDateTo),
    customerMode,
  }
}

export function hasActiveAudienceFilters(filter: NewsletterAudienceFilter): boolean {
  return (
    !filter.activeOnly ||
    Boolean(filter.source) ||
    Boolean(filter.signupDateFrom) ||
    Boolean(filter.signupDateTo) ||
    filter.customerMode !== 'all'
  )
}
