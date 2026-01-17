import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedRewards() {
  console.log('🎁 Seeding Loyalty Rewards...\n')
  
  const rewards = [
    {
      id: 'reward-5off',
      name: '$5 Off Your Order',
      slug: 'five-dollars-off',
      description: 'Get $5 off your next purchase',
      pointsCost: 500,
      rewardType: 'DISCOUNT' as const,
      value: 5,
      isActive: true,
      sortOrder: 0,
    },
    {
      id: 'reward-10off',
      name: '$10 Off Your Order',
      slug: 'ten-dollars-off',
      description: 'Get $10 off your next purchase',
      pointsCost: 1000,
      rewardType: 'DISCOUNT' as const,
      value: 10,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'reward-25off',
      name: '$25 Off Your Order',
      slug: 'twentyfive-dollars-off',
      description: 'Get $25 off your next purchase',
      pointsCost: 2000,
      rewardType: 'DISCOUNT' as const,
      value: 25,
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 'reward-freeship',
      name: 'Free Shipping',
      slug: 'free-shipping',
      description: 'Free standard shipping on your next order',
      pointsCost: 300,
      rewardType: 'FREE_SHIPPING' as const,
      value: null,
      isActive: true,
      sortOrder: 3,
    },
    {
      id: 'reward-15percent',
      name: '15% Off Entire Order',
      slug: 'fifteen-percent-off',
      description: '15% off your entire order (max $50 discount)',
      pointsCost: 1500,
      rewardType: 'DISCOUNT' as const,
      value: 15,
      isActive: true,
      metadata: JSON.stringify({ type: 'percentage', maxDiscount: 50 }),
      sortOrder: 4,
    },
    {
      id: 'reward-earlyaccess',
      name: 'Early Drop Access Pass',
      slug: 'early-drop-access',
      description: 'Get 24-hour early access to the next limited drop',
      pointsCost: 750,
      rewardType: 'EARLY_ACCESS' as const,
      value: null,
      isActive: true,
      sortOrder: 5,
    },
    {
      id: 'reward-50off',
      name: '$50 Off Your Order',
      slug: 'fifty-dollars-off',
      description: 'Get $50 off your next purchase - best value!',
      pointsCost: 3500,
      rewardType: 'DISCOUNT' as const,
      value: 50,
      isActive: true,
      sortOrder: 6,
    },
    {
      id: 'reward-mystery',
      name: 'Mystery Gift Box',
      slug: 'mystery-gift-box',
      description: 'Receive a surprise gift box with exclusive items',
      pointsCost: 5000,
      rewardType: 'PHYSICAL_PERK' as const,
      value: null,
      isActive: true,
      minTierRequired: 'tier-bestie',
      sortOrder: 7,
    },
  ]

  for (const reward of rewards) {
    await prisma.reward.upsert({
      where: { id: reward.id },
      update: reward,
      create: reward,
    })
    console.log(`   ✅ ${reward.name} (${reward.pointsCost} pts)`)
  }

  console.log(`\n🎉 Seeded ${rewards.length} loyalty rewards!`)
}

seedRewards()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
