import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let prisma: PrismaClient

// Configure Neon for serverless environments (Vercel)
if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview') {
  neonConfig.webSocketConstructor = ws
  const connectionString = process.env.POSTGRES_PRISMA_URL
  
  if (!connectionString) {
    throw new Error('POSTGRES_PRISMA_URL is not defined')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaNeon(pool as any) // Type assertion needed for now
  
  prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: adapter as any })
} else {
  // Local development uses standard Prisma Client
  prisma = globalForPrisma.prisma ?? new PrismaClient()
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export { prisma }