import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Updating tier minAnnualPoints...')
  
  // Update Head tier
  await prisma.loyaltyTier.updateMany({
    where: { slug: 'head' },
    data: { minAnnualPoints: 0 }
  })
  
  // Update Heart tier
  await prisma.loyaltyTier.updateMany({
    where: { slug: 'heart' },
    data: { minAnnualPoints: 200 }
  })
  
  // Update Mind tier
  await prisma.loyaltyTier.updateMany({
    where: { slug: 'mind' },
    data: { minAnnualPoints: 500 }
  })
  
  // Update Overdrive tier
  await prisma.loyaltyTier.updateMany({
    where: { slug: 'overdrive' },
    data: { minAnnualPoints: 2000 }
  })
  
  // Verify the updates
  const tiers = await prisma.loyaltyTier.findMany({
    where: { slug: { in: ['head', 'heart', 'mind', 'overdrive'] } },
    orderBy: { minAnnualPoints: 'asc' }
  })
  
  console.log('✅ Updated tier thresholds:')
  tiers.forEach(t => {
    console.log(`  ${t.name}: minAnnualPoints=${t.minAnnualPoints}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
