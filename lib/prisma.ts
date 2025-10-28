import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let prisma: PrismaClient

// Use Neon serverless adapter in production/preview on Vercel
if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview') {
  neonConfig.webSocketConstructor = ws
  const connectionString = process.env.POSTGRES_PRISMA_URL
  
  if (!connectionString) {
    throw new Error('POSTGRES_PRISMA_URL is not defined')
  }

  const pool = new Pool({ connectionString })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaNeon(pool as any)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: adapter as any })
} else {
  // Local development - use standard Prisma Client
  prisma = globalForPrisma.prisma ?? new PrismaClient()
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export { prisma }