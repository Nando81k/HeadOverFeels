import { PrismaClient } from '@prisma/client'
import { parseHistoricalCliArgs, printHistoricalUsage } from './historical-cli-utils'
import { buildHistoricalVerificationReport } from './historical-seed-engine'

const prisma = new PrismaClient()

async function main() {
  const args = parseHistoricalCliArgs()

  if (process.argv.includes('--help')) {
    printHistoricalUsage('verify-historical-seed.ts')
    return
  }

  const report = await buildHistoricalVerificationReport(prisma, {
    from: args.from,
    to: args.to,
  })

  console.log('🔎 Historical Seed Verification')
  console.log(`   Date coverage target: ${report.dateCoverage.from.toISOString()} → ${report.dateCoverage.to.toISOString()}`)
  console.log(`   First order date: ${report.dateCoverage.firstOrderDate?.toISOString() ?? 'none'}`)
  console.log(`   Last order date: ${report.dateCoverage.lastOrderDate?.toISOString() ?? 'none'}`)
  console.log('\n📊 Core counts')
  console.table({
    customers: report.modelCounts.customers,
    products: report.modelCounts.products,
    variants: report.modelCounts.variants,
    orders: report.modelCounts.orders,
    orderItems: report.modelCounts.orderItems,
    reviews: report.modelCounts.reviews,
    loyaltyPoints: report.loyalty.pointsTransactions,
    redemptions: report.loyalty.redemptions,
    promotions: report.promoAndNewsletter.promotions,
    popups: report.promoAndNewsletter.popups,
    newsletterSubscribers: report.promoAndNewsletter.subscribers,
    newsletterCampaigns: report.promoAndNewsletter.campaigns,
    newsletterDeliveries: report.promoAndNewsletter.deliveries,
    supportTickets: report.modelCounts.supportTickets,
    expenses: report.modelCounts.expenses,
    giftCards: report.modelCounts.giftCards,
  })
}

main()
  .catch((error) => {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
