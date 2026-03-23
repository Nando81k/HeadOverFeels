import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeNewsletterEmail } from '@/lib/newsletter/types'

export interface SubscribeToNewsletterInput {
  email: string
  source?: string
  sourceDetails?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

export interface UnsubscribeFromNewsletterInput {
  email: string
  reason?: string
  source?: string
}

export interface SubscribeResult {
  normalizedEmail: string
  alreadySubscribed: boolean
  reactivated: boolean
}

function sanitizeOptionalValue(value?: string): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

async function setCustomerNewsletterByEmail(email: string, isSubscribed: boolean) {
  const customer = await prisma.customer.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      newsletter: true,
    },
  })

  if (!customer || customer.newsletter === isSubscribed) {
    return customer
  }

  return prisma.customer.update({
    where: { id: customer.id },
    data: { newsletter: isSubscribed },
    select: {
      id: true,
      newsletter: true,
    },
  })
}

export async function subscribeToNewsletter(input: SubscribeToNewsletterInput): Promise<SubscribeResult> {
  const normalizedEmail = normalizeNewsletterEmail(input.email)
  const source = sanitizeOptionalValue(input.source)
  const sourceDetails = sanitizeOptionalValue(input.sourceDetails)
  const utmSource = sanitizeOptionalValue(input.utmSource)
  const utmMedium = sanitizeOptionalValue(input.utmMedium)
  const utmCampaign = sanitizeOptionalValue(input.utmCampaign)

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      isActive: true,
      source: true,
      sourceDetails: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
    },
  })

  const updateData: Prisma.NewsletterSubscriberUpdateInput = {
    isActive: true,
    unsubscribedAt: null,
    unsubscribeReason: null,
    ...(source ? { source } : {}),
    ...(sourceDetails ? { sourceDetails } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
  }

  if (existing) {
    await prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data: updateData,
    })
  } else {
    await prisma.newsletterSubscriber.create({
      data: {
        email: normalizedEmail,
        source,
        sourceDetails,
        utmSource,
        utmMedium,
        utmCampaign,
        isActive: true,
      },
    })
  }

  await setCustomerNewsletterByEmail(normalizedEmail, true)

  return {
    normalizedEmail,
    alreadySubscribed: Boolean(existing?.isActive),
    reactivated: Boolean(existing && !existing.isActive),
  }
}

export async function unsubscribeFromNewsletter(input: UnsubscribeFromNewsletterInput): Promise<{ normalizedEmail: string }> {
  const normalizedEmail = normalizeNewsletterEmail(input.email)
  const reason = sanitizeOptionalValue(input.reason)
  const source = sanitizeOptionalValue(input.source)

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      source: true,
    },
  })

  if (existing) {
    await prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
        unsubscribeReason: reason,
      },
    })
  } else {
    await prisma.newsletterSubscriber.create({
      data: {
        email: normalizedEmail,
        source: source || 'unsubscribe',
        isActive: false,
        unsubscribeReason: reason,
        unsubscribedAt: new Date(),
      },
    })
  }

  await setCustomerNewsletterByEmail(normalizedEmail, false)

  return { normalizedEmail }
}

export async function ensureCanonicalSubscriberFromCustomer(email: string, source = 'customer_account') {
  const normalizedEmail = normalizeNewsletterEmail(email)

  await prisma.newsletterSubscriber.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      source,
      isActive: true,
    },
    update: {
      isActive: true,
      unsubscribedAt: null,
      unsubscribeReason: null,
      source,
    },
  })

  return normalizedEmail
}

export async function backfillCanonicalSubscribersFromCustomers(): Promise<{
  processed: number
  created: number
  reactivated: number
  untouched: number
}> {
  const customers = await prisma.customer.findMany({
    where: { newsletter: true },
    select: {
      email: true,
    },
  })

  const normalizedEmails = Array.from(new Set(customers.map((customer) => normalizeNewsletterEmail(customer.email))))

  if (normalizedEmails.length === 0) {
    return { processed: 0, created: 0, reactivated: 0, untouched: 0 }
  }

  const existingSubscribers = await prisma.newsletterSubscriber.findMany({
    where: { email: { in: normalizedEmails } },
    select: {
      email: true,
      isActive: true,
      source: true,
    },
  })

  const existingMap = new Map(existingSubscribers.map((subscriber) => [normalizeNewsletterEmail(subscriber.email), subscriber]))

  let created = 0
  let reactivated = 0
  let untouched = 0

  for (const email of normalizedEmails) {
    const existing = existingMap.get(email)

    if (!existing) {
      created += 1
      await prisma.newsletterSubscriber.create({
        data: {
          email,
          source: 'customer_sync',
          isActive: true,
        },
      })
      continue
    }

    if (!existing.isActive) {
      reactivated += 1
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: {
          isActive: true,
          unsubscribedAt: null,
          unsubscribeReason: null,
          source: existing.source || 'customer_sync',
        },
      })
      continue
    }

    untouched += 1
  }

  return {
    processed: normalizedEmails.length,
    created,
    reactivated,
    untouched,
  }
}

export async function syncCustomersFromCanonicalSubscribers(): Promise<{
  processed: number
  updatedToTrue: number
  updatedToFalse: number
}> {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    select: {
      email: true,
      isActive: true,
    },
  })

  const normalizedEmails = Array.from(new Set(subscribers.map((subscriber) => normalizeNewsletterEmail(subscriber.email))))

  if (normalizedEmails.length === 0) {
    return { processed: 0, updatedToTrue: 0, updatedToFalse: 0 }
  }

  const customers = await prisma.customer.findMany({
    where: {
      email: {
        in: normalizedEmails,
      },
    },
    select: {
      id: true,
      email: true,
      newsletter: true,
    },
  })

  const subscriberMap = new Map(subscribers.map((subscriber) => [normalizeNewsletterEmail(subscriber.email), subscriber]))

  let updatedToTrue = 0
  let updatedToFalse = 0

  for (const customer of customers) {
    const normalizedEmail = normalizeNewsletterEmail(customer.email)
    const subscriber = subscriberMap.get(normalizedEmail)

    if (!subscriber) {
      continue
    }

    if (subscriber.isActive && !customer.newsletter) {
      updatedToTrue += 1
      await prisma.customer.update({
        where: { id: customer.id },
        data: { newsletter: true },
      })
      continue
    }

    if (!subscriber.isActive && customer.newsletter) {
      updatedToFalse += 1
      await prisma.customer.update({
        where: { id: customer.id },
        data: { newsletter: false },
      })
    }
  }

  return {
    processed: customers.length,
    updatedToTrue,
    updatedToFalse,
  }
}
