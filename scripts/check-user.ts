import { prisma } from '../lib/prisma'

async function checkUser() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: npx tsx scripts/check-user.ts <email>')
    process.exit(1)
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        isAdmin: true,
        createdAt: true,
      },
    })

    if (!customer) {
      console.log(`❌ Customer not found: ${email}`)
      process.exit(1)
    }

    console.log('\n✅ Customer found:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`ID:       ${customer.id}`)
    console.log(`Email:    ${customer.email}`)
    console.log(`Name:     ${customer.name || '(not set)'}`)
    console.log(`Password: ${customer.password ? '✓ Set' : '✗ NOT SET'}`)
    console.log(`Admin:    ${customer.isAdmin ? '✓ Yes' : '✗ No'}`)
    console.log(`Created:  ${customer.createdAt}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (!customer.password) {
      console.log('⚠️  WARNING: No password set!')
      console.log('This account was created before auth was implemented.')
      console.log('The user needs to sign up through the website to set a password.')
    }

  } catch (error) {
    console.error('Error checking user:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkUser()
