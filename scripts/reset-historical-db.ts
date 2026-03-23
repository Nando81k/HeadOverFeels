import { PrismaClient } from '@prisma/client'
import { parseHistoricalCliArgs, printHistoricalUsage } from './historical-cli-utils'
import { buildHistoricalVerificationReport, printHistoricalSeedSummary, runHistoricalSeed } from './historical-seed-engine'
import {
  hasAnyAdminIdentity,
  inspectDatabaseTarget,
  restoreAdminIdentities,
  snapshotAdminIdentities,
  truncatePublicTables,
} from '../lib/seed/historical/reset'

const prisma = new PrismaClient()
const CONFIRM_TOKEN = 'YES_RESET_DATABASE'

async function main() {
  const args = parseHistoricalCliArgs()

  if (process.argv.includes('--help')) {
    printHistoricalUsage('reset-historical-db.ts')
    return
  }

  if (args.confirmReset !== CONFIRM_TOKEN) {
    console.error(`❌ Missing required confirmation flag: --confirm-reset ${CONFIRM_TOKEN}`)
    process.exit(1)
  }

  const target = inspectDatabaseTarget(process.env.DATABASE_URL)
  console.log('⚠️  DESTRUCTIVE RESET STARTING')
  console.log(`   Provider: ${target.provider}`)
  console.log(`   Host: ${target.host}`)
  console.log(`   Database: ${target.database}`)
  console.log(`   Schema: ${target.schema}`)
  console.log('')

  console.log('📸 Snapshotting admin identities...')
  const snapshot = await snapshotAdminIdentities(prisma)
  console.log(`   AdminUser rows: ${snapshot.adminUsers.length}`)
  console.log(`   Customer isAdmin rows: ${snapshot.adminCustomers.length}`)

  if (!hasAnyAdminIdentity(snapshot)) {
    throw new Error('No admin accounts found in backup snapshot. Aborting destructive reset.')
  }

  console.log('\n🧨 Truncating public tables (excluding _prisma_migrations)...')
  const truncatedTables = await truncatePublicTables(prisma)
  console.log(`   Truncated ${truncatedTables} tables`)

  console.log('\n♻️  Restoring admin identities (credentials + role/flags only)...')
  const restored = await restoreAdminIdentities(prisma, snapshot)
  console.log(`   Restored AdminUser rows: ${restored.restoredAdminUsers}`)
  console.log(`   Restored admin Customer rows: ${restored.restoredAdminCustomers}`)

  console.log('\n🌱 Running historical seeder...')
  const summary = await runHistoricalSeed(prisma, {
    scale: args.scale,
    from: args.from,
    to: args.to,
    seed: args.seed,
  })

  printHistoricalSeedSummary(summary)

  console.log('\n🔎 Running post-seed verification...')
  const report = await buildHistoricalVerificationReport(prisma, {
    from: args.from,
    to: args.to,
  })

  console.log(`   Orders date coverage: ${report.dateCoverage.firstOrderDate?.toISOString() ?? 'none'} → ${report.dateCoverage.lastOrderDate?.toISOString() ?? 'none'}`)
  console.log(`   Loyalty tiers: ${report.loyalty.tiers}`)
  console.log(`   Promotions/Campaigns/Deliveries: ${report.promoAndNewsletter.promotions}/${report.promoAndNewsletter.campaigns}/${report.promoAndNewsletter.deliveries}`)
  console.log('\n✅ Reset + historical reseed complete')
}

main()
  .catch((error) => {
    console.error('❌ Reset orchestration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
