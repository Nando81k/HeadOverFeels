import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetAdminPoints() {
  // Get newcomer tier
  const newcomerTier = await prisma.loyaltyTier.findFirst({
    where: { slug: 'newcomer' }
  })
  
  if (!newcomerTier) {
    console.log('Newcomer tier not found')
    return
  }
  
  console.log('Found newcomer tier:', newcomerTier.name, '(ID:', newcomerTier.id, ')')
  
  // Update all admin accounts
  const result = await prisma.customer.updateMany({
    where: { isAdmin: true },
    data: {
      currentPoints: 0,
      lifetimePoints: 0,
      annualPointsEarned: 0,
      loyaltyTierId: newcomerTier.id
    }
  })
  
  console.log('\nUpdated', result.count, 'admin accounts to 0 points and newcomer tier')
  
  // List affected admins
  const admins = await prisma.customer.findMany({
    where: { isAdmin: true },
    select: { 
      email: true, 
      name: true, 
      currentPoints: true, 
      lifetimePoints: true,
      loyaltyTier: { select: { name: true, slug: true } } 
    }
  })
  
  console.log('\nAdmin accounts after reset:')
  admins.forEach(a => {
    console.log(`  - ${a.email} | ${a.name}`)
    console.log(`    Points: ${a.currentPoints} | Lifetime: ${a.lifetimePoints} | Tier: ${a.loyaltyTier?.name}`)
  })
}

resetAdminPoints()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
