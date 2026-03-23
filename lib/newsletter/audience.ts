import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  NewsletterAudienceFilter,
  NewsletterRecipient,
  normalizeAudienceFilter,
  normalizeNewsletterEmail,
} from '@/lib/newsletter/types'

export function buildAudienceWhere(filter: NewsletterAudienceFilter): Prisma.NewsletterSubscriberWhereInput {
  const where: Prisma.NewsletterSubscriberWhereInput = {}

  if (filter.activeOnly) {
    where.isActive = true
  }

  if (filter.source) {
    where.source = filter.source
  }

  if (filter.signupDateFrom || filter.signupDateTo) {
    where.createdAt = {
      ...(filter.signupDateFrom ? { gte: new Date(filter.signupDateFrom) } : {}),
      ...(filter.signupDateTo ? { lte: new Date(filter.signupDateTo) } : {}),
    }
  }

  return where
}

async function getCustomerEmailSet(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) {
    return new Set<string>()
  }

  const customers = await prisma.customer.findMany({
    where: {
      email: {
        in: emails,
      },
    },
    select: {
      email: true,
    },
  })

  return new Set(customers.map((customer) => normalizeNewsletterEmail(customer.email)))
}

export async function resolveAudienceRecipients(
  filterInput: unknown
): Promise<{ filter: NewsletterAudienceFilter; recipients: NewsletterRecipient[] }> {
  const filter = normalizeAudienceFilter(filterInput)
  const where = buildAudienceWhere(filter)

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where,
    select: {
      id: true,
      email: true,
      source: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (subscribers.length === 0) {
    return {
      filter,
      recipients: [],
    }
  }

  const normalizedEmails = subscribers.map((subscriber) => normalizeNewsletterEmail(subscriber.email))
  const customerEmailSet = await getCustomerEmailSet(normalizedEmails)

  const recipients = subscribers
    .map((subscriber) => {
      const normalizedEmail = normalizeNewsletterEmail(subscriber.email)
      const isCustomer = customerEmailSet.has(normalizedEmail)

      return {
        subscriberId: subscriber.id,
        email: normalizedEmail,
        source: subscriber.source,
        createdAt: subscriber.createdAt,
        isCustomer,
      }
    })
    .filter((recipient) => {
      if (filter.customerMode === 'customer') {
        return recipient.isCustomer
      }

      if (filter.customerMode === 'subscriber') {
        return !recipient.isCustomer
      }

      return true
    })

  return {
    filter,
    recipients,
  }
}

export async function getAudienceCount(filterInput: unknown): Promise<number> {
  const { recipients } = await resolveAudienceRecipients(filterInput)
  return recipients.length
}
