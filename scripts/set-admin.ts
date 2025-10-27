import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setAdminUser(email: string) {
  try {
    // Find the customer by email
    const customer = await prisma.customer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
      },
    })

    if (!customer) {
      console.error(`❌ Customer with email "${email}" not found`)
      process.exit(1)
    }

    if (customer.isAdmin) {
      console.log(`✅ Customer "${customer.name}" (${customer.email}) is already an admin`)
      process.exit(0)
    }

    // Update the customer to be an admin
    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: { isAdmin: true },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
      },
    })

    console.log('✅ Successfully set admin status!')
    console.log(`   Name: ${updatedCustomer.name}`)
    console.log(`   Email: ${updatedCustomer.email}`)
    console.log(`   Admin: ${updatedCustomer.isAdmin}`)
  } catch (error) {
    console.error('❌ Error setting admin status:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Get email from command line arguments
const email = process.argv[2]

if (!email) {
  console.error('❌ Usage: npx tsx scripts/set-admin.ts <email>')
  console.error('   Example: npx tsx scripts/set-admin.ts admin@example.com')
  process.exit(1)
}

setAdminUser(email)
