import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

if (process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local' })
}

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking recent order...\n')

  // Get most recent order
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: {
        contains: 'HOF-1762120887024'
      }
    },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          currentPoints: true,
          lifetimePoints: true,
          totalSpent: true,
          totalOrders: true,
          loyaltyTier: {
            select: {
              name: true,
              pointMultiplier: true,
            }
          }
        }
      }
    }
  })

  if (!order) {
    console.log('❌ Order not found')
    return
  }

  console.log('📦 Order Details:')
  console.log(`   Order Number: ${order.orderNumber}`)
  console.log(`   Status: ${order.status}`)
  console.log(`   Total: $${order.total}`)
  console.log(`   Customer ID: ${order.customerId}`)
  console.log(`   Created: ${order.createdAt}`)
  console.log(`   Updated: ${order.updatedAt}`)

  if (order.customer) {
    console.log('\n👤 Customer Stats:')
    console.log(`   Email: ${order.customer.email}`)
    console.log(`   Current Points: ${order.customer.currentPoints}`)
    console.log(`   Lifetime Points: ${order.customer.lifetimePoints}`)
    console.log(`   Total Spent: $${order.customer.totalSpent}`)
    console.log(`   Total Orders: ${order.customer.totalOrders}`)
    console.log(`   Tier: ${order.customer.loyaltyTier?.name} (${order.customer.loyaltyTier?.pointMultiplier}x)`)
  }

  // Check points transactions for this order
  console.log('\n💎 Points Transactions for this order:')
  const transactions = await prisma.pointsTransaction.findMany({
    where: {
      orderId: order.id
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  if (transactions.length === 0) {
    console.log('   ❌ No points transactions found for this order')
    console.log('   This means the CRM webhook did not trigger!')
  } else {
    transactions.forEach(tx => {
      console.log(`   - ${tx.type}: ${tx.points > 0 ? '+' : ''}${tx.points} points`)
      console.log(`     Description: ${tx.description}`)
      console.log(`     Date: ${tx.createdAt}`)
    })
  }

  // Check all points transactions for customer
  console.log('\n💎 All Points Transactions for Customer:')
  const allTransactions = await prisma.pointsTransaction.findMany({
    where: {
      customerId: order.customerId!
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  })

  if (allTransactions.length === 0) {
    console.log('   ❌ No points transactions found')
  } else {
    allTransactions.forEach(tx => {
      console.log(`   - ${tx.type}: ${tx.points > 0 ? '+' : ''}${tx.points} points`)
      console.log(`     Description: ${tx.description}`)
      console.log(`     Order ID: ${tx.orderId || 'N/A'}`)
      console.log(`     Date: ${tx.createdAt}`)
      console.log('')
    })
  }

  console.log('\n✨ Check complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
