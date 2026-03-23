import { PrismaClient } from '@prisma/client'
import { parseHistoricalCliArgs, printHistoricalUsage } from './historical-cli-utils'
import { printHistoricalSeedSummary, runHistoricalSeed } from './historical-seed-engine'

const prisma = new PrismaClient()

async function main() {
  const args = parseHistoricalCliArgs()

  if (process.argv.includes('--help')) {
    printHistoricalUsage('seed-historical.ts')
    return
  }

  console.log('🌱 Starting historical 3-year seeding...')
  const summary = await runHistoricalSeed(prisma, {
    scale: args.scale,
    from: args.from,
    to: args.to,
    seed: args.seed,
  })

  printHistoricalSeedSummary(summary)
}

main()
  .catch((error) => {
    console.error('❌ Historical seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
