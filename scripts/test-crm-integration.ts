import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local' })
}

const prisma = new PrismaClient()

async function testCRMIntegration() {
  console.log('🧪 Testing CRM Integration...\n')

  try {
    // 1. Find an existing customer with orders
    const customer = await prisma.customer.findFirst({
      where: {
        orders: {
          some: {
            status: 'CONFIRMED',
          },
        },
      },
      include: {
        loyaltyTier: true,
        orders: {
          where: { status: 'CONFIRMED' },
          take: 1,
        },
      },
    })

    if (!customer || customer.orders.length === 0) {
      console.log('⚠️  No customers with confirmed orders found.')
      console.log('   Create an order through the checkout flow to test CRM integration.')
      return
    }

    console.log(`✅ Found Customer: ${customer.email}`)
    console.log(`   Current CRM Stats:`)
    console.log(`   - Total Spent: $${customer.totalSpent}`)
    console.log(`   - Total Orders: ${customer.totalOrders}`)
    console.log(`   - Avg Order Value: $${customer.avgOrderValue.toFixed(2)}`)
    console.log(`   - Last Order: ${customer.lastOrderDate || 'N/A'}`)
    console.log(`   - Annual Spend: $${customer.annualSpend}`)
    console.log(`   - Current Points: ${customer.currentPoints}`)
    console.log(`   - Lifetime Points: ${customer.lifetimePoints}`)
    console.log(`   - Loyalty Tier: ${customer.loyaltyTier?.name || 'None'}\n`)

    // 2. Check points transactions
    const transactions = await prisma.pointsTransaction.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    console.log(`📊 Recent Points Transactions (last 5):`)
    if (transactions.length === 0) {
      console.log('   No transactions found')
    } else {
      transactions.forEach((txn) => {
        const sign = txn.points > 0 ? '+' : ''
        console.log(`   - ${txn.type}: ${sign}${txn.points} pts - ${txn.description}`)
      })
    }

    // 3. Verify CRM integration is working
    console.log(`\n✅ CRM Integration Status:`)
    
    const hasCorrectTotalSpent = customer.totalSpent > 0
    const hasCorrectTotalOrders = customer.totalOrders > 0
    const hasPoints = customer.currentPoints > 0 || customer.lifetimePoints > 0
    const hasLastOrderDate = customer.lastOrderDate !== null
    
    console.log(`   - Total Spent Tracked: ${hasCorrectTotalSpent ? '✅' : '❌'}`)
    console.log(`   - Total Orders Tracked: ${hasCorrectTotalOrders ? '✅' : '❌'}`)
    console.log(`   - Points Awarded: ${hasPoints ? '✅' : '❌'}`)
    console.log(`   - Last Order Date: ${hasLastOrderDate ? '✅' : '❌'}`)

    if (hasCorrectTotalSpent && hasCorrectTotalOrders && hasPoints && hasLastOrderDate) {
      console.log(`\n🎉 CRM Integration is WORKING!`)
    } else {
      console.log(`\n⚠️  CRM Integration may need attention - some stats are missing.`)
      console.log(`   This could mean orders were created before CRM integration was added.`)
      console.log(`   New orders will automatically update these stats.`)
    }

    // 4. Check tier system
    const allTiers = await prisma.loyaltyTier.findMany({
      orderBy: { minAnnualSpend: 'asc' },
    })

    console.log(`\n🎖️  Loyalty Tier System:`)
    allTiers.forEach((tier) => {
      const isCurrent = customer.loyaltyTierId === tier.id
      const arrow = isCurrent ? ' 👈 CURRENT' : ''
      console.log(`   - ${tier.name}: $${tier.minAnnualSpend}/yr (${tier.pointMultiplier}x points)${arrow}`)
    })

    // Suggest next tier
    if (customer.loyaltyTier) {
      const nextTier = allTiers.find(
        (t) => t.minAnnualSpend > customer.annualSpend && !t.isInviteOnly
      )
      if (nextTier) {
        const amountNeeded = nextTier.minAnnualSpend - customer.annualSpend
        console.log(`\n   💡 Customer needs $${amountNeeded.toFixed(2)} more to reach ${nextTier.name} tier`)
      } else {
        console.log(`\n   🌟 Customer is at the highest non-invite tier!`)
      }
    }

    console.log(`\n✨ Test complete!`)
  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testCRMIntegration()
