import { prisma } from '../lib/prisma'

async function testMindTierAI() {
  try {
    console.log('🧪 Testing Mind Tier AI Access...\n')

    // Get Mind tier
    const mindTier = await prisma.loyaltyTier.findUnique({
      where: { slug: 'mind' },
    })

    if (!mindTier) {
      console.error('❌ Mind tier not found')
      return
    }

    console.log('✅ Found Mind tier:', mindTier.name)

    // Get first customer
    const customer = await prisma.customer.findFirst()

    if (!customer) {
      console.error('❌ No customers found')
      return
    }

    console.log('✅ Found customer:', customer.email)

    // Assign Mind tier to customer
    await prisma.customer.update({
      where: { id: customer.id },
      data: { loyaltyTierId: mindTier.id },
    })

    console.log('✅ Assigned Mind tier to customer')
    console.log('\n📝 Test customer details:')
    console.log('  ID:', customer.id)
    console.log('  Email:', customer.email)
    console.log('  Tier:', mindTier.name)
    console.log('\n💡 You can now test the AI chat with this customer ID')
    console.log('   Use customerId:', customer.id)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testMindTierAI()
