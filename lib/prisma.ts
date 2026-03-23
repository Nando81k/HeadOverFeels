import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const unpooledUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL
  const shouldUseUnpooled =
    process.env.NODE_ENV !== 'production' &&
    typeof unpooledUrl === 'string' &&
    unpooledUrl.length > 0

  if (shouldUseUnpooled) {
    return new PrismaClient({
      datasources: {
        db: {
          url: unpooledUrl,
        },
      },
    })
  }

  return new PrismaClient()
}

function hasNewsletterCampaignDelegate(client: PrismaClient): boolean {
  return Boolean((client as unknown as { newsletterCampaign?: unknown }).newsletterCampaign)
}

let prismaClient = globalForPrisma.prisma ?? createPrismaClient()

// In dev, hot-reload can keep an old cached PrismaClient instance around.
// If that stale instance is missing newer delegates, recreate it.
if (!hasNewsletterCampaignDelegate(prismaClient)) {
  void prismaClient.$disconnect().catch(() => undefined)
  prismaClient = createPrismaClient()
}

export const prisma = prismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
