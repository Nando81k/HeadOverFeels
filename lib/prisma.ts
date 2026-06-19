import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: connectionString! })
  return new PrismaClient({ adapter })
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
