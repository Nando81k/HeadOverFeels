import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { updateCustomerStatsOnOrderCompletion } from '../lib/crm/service'
import { awardReferralPoints } from '../lib/loyalty/service'

if (process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local' })
}

const prisma = new PrismaClient()

async function main() {
  const orderNumber = process.argv[2]

  if (!orderNumber) {
    console.error('❌ Please provide an order number')
    console.log('Usage: npx tsx scripts/confirm-order.ts HOF-1762120887024-WIOX1TTZI')
    process.exit(1)
  }

  console.log(`🔍 Looking for order: ${orderNumber}\n`)

  // Find the order
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: {
        contains: orderNumber
      }
    },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          referredBy: true,
        }
      }
    }
  })

  if (!order) {
    console.error(`❌ Order not found: ${orderNumber}`)
    process.exit(1)
  }

  console.log('📦 Order found:')
  console.log(`   Order ID: ${order.id}`)
  console.log(`   Order Number: ${order.orderNumber}`)
  console.log(`   Status: ${order.status}`)
  console.log(`   Total: $${order.total}`)
  console.log(`   Customer: ${order.customer?.email || 'Guest'}`)

  if (order.status === 'CONFIRMED') {
    console.log('\n⚠️  Order is already CONFIRMED')
    console.log('   Do you want to re-run CRM integration? (y/n)')
    process.exit(0)
  }

  console.log('\n✅ Confirming order and triggering CRM integration...\n')

  try {
    // Update order status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID'
      }
    })
    console.log('✅ Order status updated to CONFIRMED')

    // Trigger CRM integration
    if (order.customerId) {
      const crmResult = await updateCustomerStatsOnOrderCompletion(
        order.customerId,
        order.id,
        order.total
      )

      if (crmResult) {
        console.log('\n✅ CRM Integration Results:')
        console.log(`   Stats Updated: ${crmResult.updated ? 'Yes' : 'No'}`)
        console.log(`   Is First Order: ${crmResult.isFirstOrder ? 'Yes' : 'No'}`)
        console.log(`   Points Awarded: ${crmResult.pointsAwarded ? 'Yes' : 'No'}`)
        
        if (crmResult.tierUpgrade) {
          console.log(`   🎉 Tier Upgraded to: ${crmResult.tierUpgrade}`)
        } else {
          console.log(`   Tier Upgrade: No`)
        }

        // Award referral points if applicable
        if (crmResult.isFirstOrder && order.customer?.referredBy) {
          await awardReferralPoints(order.customer.referredBy, order.customerId)
          console.log(`\n🎁 Referral bonus awarded to referrer: ${order.customer.referredBy}`)
        }
      }

      // Show updated customer stats
      const updatedCustomer = await prisma.customer.findUnique({
        where: { id: order.customerId },
        select: {
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
      })

      console.log('\n📊 Updated Customer Stats:')
      console.log(`   Current Points: ${updatedCustomer?.currentPoints}`)
      console.log(`   Lifetime Points: ${updatedCustomer?.lifetimePoints}`)
      console.log(`   Total Spent: $${updatedCustomer?.totalSpent}`)
      console.log(`   Total Orders: ${updatedCustomer?.totalOrders}`)
      console.log(`   Tier: ${updatedCustomer?.loyaltyTier?.name} (${updatedCustomer?.loyaltyTier?.pointMultiplier}x)`)

      console.log('\n✨ Order confirmed and CRM integration complete!')
    } else {
      console.log('\n⚠️  Order has no customer ID - skipping CRM integration')
    }
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
