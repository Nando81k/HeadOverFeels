import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local' })
}

const prisma = new PrismaClient()

async function assignDefaultTier() {
  try {
    // Get the Head tier (default tier, minSpend = 0)
    const headTier = await prisma.loyaltyTier.findFirst({
      where: { slug: 'head' },
    })

    if (!headTier) {
      console.log('❌ Head tier not found. Run seed-loyalty.ts first.')
      return
    }

    console.log(`✅ Found default tier: ${headTier.name}`)

    // Find customers without a tier
    const customersWithoutTier = await prisma.customer.findMany({
      where: { loyaltyTierId: null },
      select: { id: true, email: true, name: true },
    })

    console.log(`\n📊 Customers without tier: ${customersWithoutTier.length}`)

    if (customersWithoutTier.length > 0) {
      // Assign Head tier to all customers without a tier
      const result = await prisma.customer.updateMany({
        where: { loyaltyTierId: null },
        data: { 
          loyaltyTierId: headTier.id,
          tierStartDate: new Date(),
        },
      })

      console.log(`\n✅ Assigned Head tier to ${result.count} customers:`)
      customersWithoutTier.forEach((c) => console.log(`   - ${c.email} (${c.name || 'N/A'})`))
    } else {
      console.log('✅ All customers already have a loyalty tier')
    }

    console.log('\n✨ Done!')
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

assignDefaultTier()
