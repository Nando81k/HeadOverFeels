import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetAdminLoyalty() {
  console.log('🔄 Resetting admin accounts loyalty data...\n')

  try {
    // Find the Newcomer tier
    const newcomerTier = await prisma.loyaltyTier.findFirst({
      where: { slug: 'newcomer' },
    })

    if (!newcomerTier) {
      console.error('❌ Newcomer tier not found! Make sure to run the seed script first.')
      return
    }

    console.log(`✅ Found Newcomer tier: ${newcomerTier.name} (${newcomerTier.id})`)

    // Find all admin accounts
    const adminAccounts = await prisma.customer.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        email: true,
        name: true,
        currentPoints: true,
        lifetimePoints: true,
        annualPointsEarned: true,
        loyaltyTier: {
          select: { name: true, slug: true },
        },
      },
    })

    if (adminAccounts.length === 0) {
      console.log('⚠️ No admin accounts found.')
      return
    }

    console.log(`\n📋 Found ${adminAccounts.length} admin account(s):\n`)

    for (const admin of adminAccounts) {
      console.log(`  - ${admin.email} (${admin.name || 'No name'})`)
      console.log(`    Current Points: ${admin.currentPoints}`)
      console.log(`    Lifetime Points: ${admin.lifetimePoints}`)
      console.log(`    Annual Points: ${admin.annualPointsEarned}`)
      console.log(`    Current Tier: ${admin.loyaltyTier?.name || 'None'}`)
    }

    // Reset all admin accounts
    console.log('\n🔄 Resetting loyalty data...\n')

    const result = await prisma.customer.updateMany({
      where: { isAdmin: true },
      data: {
        currentPoints: 0,
        lifetimePoints: 0,
        annualPointsEarned: 0,
        totalSpent: 0,
        totalOrders: 0,
        annualSpend: 0,
        loyaltyTierId: newcomerTier.id,
      },
    })

    console.log(`✅ Successfully reset ${result.count} admin account(s)!`)

    // Verify the changes
    const updatedAdmins = await prisma.customer.findMany({
      where: { isAdmin: true },
      select: {
        email: true,
        currentPoints: true,
        lifetimePoints: true,
        annualPointsEarned: true,
        loyaltyTier: {
          select: { name: true, slug: true },
        },
      },
    })

    console.log('\n📋 Updated admin accounts:\n')
    for (const admin of updatedAdmins) {
      console.log(`  - ${admin.email}`)
      console.log(`    Current Points: ${admin.currentPoints}`)
      console.log(`    Lifetime Points: ${admin.lifetimePoints}`)
      console.log(`    Annual Points: ${admin.annualPointsEarned}`)
      console.log(`    Tier: ${admin.loyaltyTier?.name || 'None'}`)
    }

    console.log('\n✨ Done!')
  } catch (error) {
    console.error('❌ Error resetting admin loyalty:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetAdminLoyalty()
