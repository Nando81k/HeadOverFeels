import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables from .env.local
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding loyalty system...')

  // Create Loyalty Tiers
  const tiers = [
    {
      name: 'Head',
      slug: 'head',
      description: 'Welcome to the journey. You\'re already part of something meaningful.',
      minAnnualSpend: 0,
      isInviteOnly: false,
      pointMultiplier: 1.0,
      freeShipping: false,
      earlyDropAccess: false,
      perks: JSON.stringify({
        birthdayPoints: true,
        dropAccess: true,
      }),
      sortOrder: 1,
    },
    {
      name: 'Heart',
      slug: 'heart',
      description: 'You feel it. The connection. The community. You\'re in your feels.',
      minAnnualSpend: 200,
      isInviteOnly: false,
      pointMultiplier: 1.25,
      freeShipping: false,
      earlyDropAccess: true,
      perks: JSON.stringify({
        birthdayPoints: true,
        dropAccess: true,
        careBox: true, // Mental health care box once/year
      }),
      sortOrder: 2,
    },
    {
      name: 'Mind',
      slug: 'mind',
      description: 'Clarity. Purpose. Understanding. You see the bigger picture.',
      minAnnualSpend: 500,
      isInviteOnly: false,
      pointMultiplier: 1.5,
      freeShipping: true,
      earlyDropAccess: true,
      perks: JSON.stringify({
        birthdayPoints: true,
        dropAccess: true,
        careBox: true,
        freeShipping: true,
        exclusiveItems: true,
        membersWall: true, // Name engraved in members wall
      }),
      sortOrder: 3,
    },
    {
      name: 'Overdrive',
      slug: 'overdrive',
      description: 'Top 1%. You\'re not just wearing the brand. You ARE the brand.',
      minAnnualSpend: 2000,
      isInviteOnly: true,
      pointMultiplier: 2.0,
      freeShipping: true,
      earlyDropAccess: true,
      perks: JSON.stringify({
        birthdayPoints: true,
        dropAccess: true,
        careBox: true,
        freeShipping: true,
        exclusiveItems: true,
        membersWall: true,
        privateDropAccess: true,
        customEmbroidery: true, // Custom embroidered item once/year
        concierge: true,
      }),
      sortOrder: 4,
    },
  ]

  for (const tier of tiers) {
    const created = await prisma.loyaltyTier.upsert({
      where: { slug: tier.slug },
      update: tier,
      create: tier,
    })
    console.log(`✅ Created tier: ${created.name}`)
  }

  // Create Rewards
  const rewards = [
    // Discount Rewards
    {
      name: '$5 Off Your Order',
      slug: '5-off',
      description: 'Save $5 on any purchase',
      pointsCost: 500,
      rewardType: 'DISCOUNT' as const,
      value: 5.0,
      isActive: true,
      sortOrder: 1,
    },
    {
      name: 'Free Shipping',
      slug: 'free-shipping',
      description: 'Free standard shipping on your next order',
      pointsCost: 900,
      rewardType: 'FREE_SHIPPING' as const,
      value: null,
      isActive: true,
      sortOrder: 2,
    },
    {
      name: '$20 Off Your Order',
      slug: '20-off',
      description: 'Save $20 on orders over $100',
      pointsCost: 1500,
      rewardType: 'DISCOUNT' as const,
      value: 20.0,
      isActive: true,
      sortOrder: 3,
    },
    
    // Early Access & Exclusive
    {
      name: 'Exclusive Drop Early Access',
      slug: 'early-access',
      description: 'Get 24-hour early access to our next limited drop',
      pointsCost: 2500,
      rewardType: 'EARLY_ACCESS' as const,
      value: null,
      isActive: true,
      minTierRequired: 'heart',
      sortOrder: 4,
    },
    {
      name: 'Unlock Exclusive Product',
      slug: 'exclusive-product',
      description: 'Access members-only items not available to the public',
      pointsCost: 3000,
      rewardType: 'EXCLUSIVE_PRODUCT' as const,
      value: null,
      isActive: true,
      minTierRequired: 'mind',
      sortOrder: 5,
    },
    
    // Charity & Purpose
    {
      name: 'Mental Health Charity Donation',
      slug: 'charity-donation',
      description: 'We\'ll donate $5 to mental health organizations on your behalf',
      pointsCost: 500,
      rewardType: 'CHARITY_DONATION' as const,
      value: 5.0,
      isActive: true,
      metadata: JSON.stringify({
        charityName: 'National Alliance on Mental Illness (NAMI)',
        charityUrl: 'https://www.nami.org',
      }),
      sortOrder: 6,
    },
    
    // Digital Content
    {
      name: 'Digital Wellness Pack',
      slug: 'digital-wellness',
      description: 'Journal templates, guided meditation audio, and phone wallpapers',
      pointsCost: 750,
      rewardType: 'DIGITAL_CONTENT' as const,
      value: null,
      isActive: true,
      metadata: JSON.stringify({
        includes: ['journal-templates', 'meditation-audio', 'wallpapers'],
      }),
      sortOrder: 7,
    },
    
    // Physical Perks
    {
      name: 'Mental Health Care Box',
      slug: 'care-box',
      description: 'Curated box with self-care items, exclusive merch, and mindfulness tools',
      pointsCost: 5000,
      rewardType: 'PHYSICAL_PERK' as const,
      value: null,
      isActive: true,
      minTierRequired: 'heart',
      maxRedemptionsPerCustomer: 1,
      metadata: JSON.stringify({
        shipping: 'free',
        estimatedDelivery: '7-10 days',
      }),
      sortOrder: 8,
    },
  ]

  for (const reward of rewards) {
    const created = await prisma.reward.upsert({
      where: { slug: reward.slug },
      update: reward,
      create: reward,
    })
    console.log(`✅ Created reward: ${created.name} (${created.pointsCost} points)`)
  }

  console.log('✨ Loyalty system seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
