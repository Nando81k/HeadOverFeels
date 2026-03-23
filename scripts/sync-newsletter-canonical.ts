import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function syncNewsletterCanonical() {
  const subscribedCustomers = await prisma.customer.findMany({
    where: {
      newsletter: true,
    },
    select: {
      email: true,
    },
  })

  const uniqueCustomerEmails = Array.from(new Set(subscribedCustomers.map((customer) => normalizeEmail(customer.email))))

  let upsertedSubscribers = 0

  for (const email of uniqueCustomerEmails) {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        source: 'customer_sync',
        isActive: true,
      },
      update: {
        isActive: true,
        unsubscribedAt: null,
        unsubscribeReason: null,
      },
    })

    upsertedSubscribers += 1
  }

  const subscribers = await prisma.newsletterSubscriber.findMany({
    select: {
      email: true,
      isActive: true,
    },
  })

  const subscriberMap = new Map(
    subscribers.map((subscriber) => [normalizeEmail(subscriber.email), subscriber.isActive])
  )

  const matchingCustomers = await prisma.customer.findMany({
    where: {
      email: {
        in: Array.from(subscriberMap.keys()),
      },
    },
    select: {
      id: true,
      email: true,
      newsletter: true,
    },
  })

  let updatedCustomerFlags = 0

  for (const customer of matchingCustomers) {
    const email = normalizeEmail(customer.email)
    const subscriberIsActive = subscriberMap.get(email)

    if (typeof subscriberIsActive !== 'boolean') {
      continue
    }

    if (customer.newsletter !== subscriberIsActive) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          newsletter: subscriberIsActive,
        },
      })
      updatedCustomerFlags += 1
    }
  }

  console.log('Newsletter canonical sync complete')
  console.log(`- upserted subscribers from customer flags: ${upsertedSubscribers}`)
  console.log(`- updated customer newsletter flags from canonical subscribers: ${updatedCustomerFlags}`)
}

syncNewsletterCanonical()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error('Failed to sync newsletter canonical data:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
