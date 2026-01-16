/**
 * Comprehensive Seed Script - Part 1: Foundation Data
 * 
 * Seeds: Loyalty Tiers, Rewards, Promotions, Loyalty Settings, 
 * Expense Categories, Budgets, Sales Goals, Admin Users, Categories, Collections
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting Comprehensive Seed - Part 1: Foundation Data...\n')

  // ============================================
  // 1. LOYALTY SETTINGS
  // ============================================
  console.log('⚙️  Seeding Loyalty Settings...')
  await prisma.loyaltySettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      isEnabled: true,
      programName: 'Care Points',
      pointsPerDollar: 10, // 10 points per dollar spent
      pointsRoundingMode: 'round',
      minimumOrderForPoints: 0,
      referralPointsReferrer: 500,
      referralPointsReferred: 250,
      referralEnabled: true,
      reviewPointsEnabled: true,
      reviewPointsAmount: 50,
      reviewWithPhotoBonus: 25,
      birthdayRewardsEnabled: true,
      birthdayRewardType: 'points',
      birthdayRewardValue: 200,
      birthdayRewardExpireDays: 30,
      pointsExpireEnabled: true,
      pointsExpireMonths: 12,
      tierEvaluationPeriod: 'annual',
      tierDowngradeEnabled: true,
      showPointsInCart: true,
      showPointsInCheckout: true,
      showTierProgress: true,
    },
  })
  console.log('   ✅ Loyalty Settings created\n')

  // ============================================
  // 2. LOYALTY TIERS
  // ============================================
  console.log('🏆 Seeding Loyalty Tiers...')
  const tiers = [
    {
      id: 'tier-newcomer',
      name: 'Newcomer',
      slug: 'newcomer',
      description: 'Welcome to the family! Start earning Care Points with every purchase.',
      minAnnualSpend: 0,
      minAnnualPoints: 0,
      pointMultiplier: 1.0,
      freeShipping: false,
      earlyDropAccess: false,
      perks: JSON.stringify([
        'Earn 10 Care Points per $1 spent',
        'Birthday bonus points',
        'Access to member-only sales',
      ]),
      sortOrder: 0,
      isActive: true,
    },
    {
      id: 'tier-friend',
      name: 'Friend',
      slug: 'friend',
      description: 'You\'re becoming part of the crew! Enjoy enhanced rewards.',
      minAnnualSpend: 100,
      minAnnualPoints: 1000,
      pointMultiplier: 1.25,
      freeShipping: false,
      earlyDropAccess: false,
      perks: JSON.stringify([
        'Earn 12.5 Care Points per $1 spent (1.25x)',
        'Birthday bonus points',
        'Early access to sales',
        'Free shipping on orders $75+',
      ]),
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'tier-bestie',
      name: 'Bestie',
      slug: 'bestie',
      description: 'You\'re one of us now! Exclusive perks await.',
      minAnnualSpend: 300,
      minAnnualPoints: 3000,
      pointMultiplier: 1.5,
      freeShipping: true,
      earlyDropAccess: false,
      perks: JSON.stringify([
        'Earn 15 Care Points per $1 spent (1.5x)',
        'FREE shipping on all orders',
        '24-hour early access to sales',
        'Exclusive Bestie-only products',
        'Double points on your birthday month',
      ]),
      sortOrder: 2,
      isActive: true,
    },
    {
      id: 'tier-soulmate',
      name: 'Soulmate',
      slug: 'soulmate',
      description: 'The ultimate bond. You get the best of everything.',
      minAnnualSpend: 750,
      minAnnualPoints: 7500,
      pointMultiplier: 2.0,
      freeShipping: true,
      earlyDropAccess: true,
      perks: JSON.stringify([
        'Earn 20 Care Points per $1 spent (2x)',
        'FREE express shipping on all orders',
        '48-hour early access to limited drops',
        'Exclusive Soulmate-only products',
        'Triple points on your birthday month',
        'Priority customer support',
        'Annual surprise gift',
      ]),
      sortOrder: 3,
      isActive: true,
    },
  ]

  for (const tier of tiers) {
    await prisma.loyaltyTier.upsert({
      where: { id: tier.id },
      update: tier,
      create: tier,
    })
    console.log(`   ✅ Tier: ${tier.name}`)
  }
  console.log('')

  // ============================================
  // 3. REWARDS
  // ============================================
  console.log('🎁 Seeding Rewards...')
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
      value: 15, // percentage
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
  ]

  for (const reward of rewards) {
    await prisma.reward.upsert({
      where: { id: reward.id },
      update: reward,
      create: reward,
    })
    console.log(`   ✅ Reward: ${reward.name} (${reward.pointsCost} pts)`)
  }
  console.log('')

  // ============================================
  // 4. PROMOTIONS
  // ============================================
  console.log('🏷️  Seeding Promotions...')
  const promotions = [
    {
      id: 'promo-welcome15',
      name: 'Welcome 15% Off',
      description: '15% off your first order when you sign up',
      type: 'PERCENTAGE' as const,
      value: 15,
      code: 'WELCOME15',
      autoApply: false,
      minimumPurchase: 50,
      maxUsesPerCustomer: 1,
      isActive: true,
      stackable: false,
    },
    {
      id: 'promo-freeship75',
      name: 'Free Shipping Over $75',
      description: 'Free shipping on orders $75 or more',
      type: 'FREE_SHIPPING' as const,
      value: 0,
      code: null,
      autoApply: true,
      minimumPurchase: 75,
      isActive: true,
      stackable: true,
    },
    {
      id: 'promo-winter20',
      name: 'Winter Sale 20% Off',
      description: '20% off all hoodies during winter sale',
      type: 'PERCENTAGE' as const,
      value: 20,
      code: 'WINTER20',
      autoApply: false,
      minimumPurchase: null,
      maxUsesTotal: 500,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-28'),
      isActive: true,
      stackable: false,
    },
    {
      id: 'promo-bogo50',
      name: 'BOGO 50% Off Tees',
      description: 'Buy one tee, get the second 50% off',
      type: 'BOGO' as const,
      value: 50,
      code: 'BOGO50',
      autoApply: false,
      minimumPurchase: null,
      isActive: true,
      stackable: false,
    },
    {
      id: 'promo-loyalty2x',
      name: 'Double Points Weekend',
      description: 'Earn 2x Care Points this weekend only!',
      type: 'PERCENTAGE' as const,
      value: 0, // No discount, just double points
      code: null,
      autoApply: true,
      excludeFromLoyalty: false, // This actually enables loyalty
      startDate: new Date('2026-01-17'),
      endDate: new Date('2026-01-19'),
      isActive: true,
      stackable: true,
    },
  ]

  for (const promo of promotions) {
    await prisma.promotion.upsert({
      where: { id: promo.id },
      update: promo,
      create: promo,
    })
    console.log(`   ✅ Promo: ${promo.name}${promo.code ? ` (${promo.code})` : ' (auto)'}`)
  }
  console.log('')

  // ============================================
  // 5. POINTS MULTIPLIER EVENTS
  // ============================================
  console.log('✨ Seeding Points Multiplier Events...')
  const multiplierEvents = [
    {
      id: 'mult-double-jan',
      name: 'January Double Points',
      description: 'Earn 2x points on all purchases in January',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      multiplier: 2.0,
      isActive: true,
    },
    {
      id: 'mult-triple-soulmate',
      name: 'Soulmate Triple Points',
      description: 'Soulmate members earn 3x points for a limited time',
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-01-20'),
      multiplier: 3.0,
      tierIds: JSON.stringify(['tier-soulmate']),
      isActive: true,
    },
  ]

  for (const event of multiplierEvents) {
    await prisma.pointsMultiplierEvent.upsert({
      where: { id: event.id },
      update: event,
      create: event,
    })
    console.log(`   ✅ Multiplier: ${event.name} (${event.multiplier}x)`)
  }
  console.log('')

  // ============================================
  // 6. EXPENSE CATEGORIES
  // ============================================
  console.log('📊 Seeding Expense Categories...')
  const expenseCategories = [
    { id: 'exp-cat-inventory', name: 'Inventory & COGS', slug: 'inventory-cogs', color: '#3B82F6', icon: 'Package' },
    { id: 'exp-cat-shipping', name: 'Shipping & Fulfillment', slug: 'shipping', color: '#10B981', icon: 'Truck' },
    { id: 'exp-cat-marketing', name: 'Marketing & Advertising', slug: 'marketing', color: '#F59E0B', icon: 'Megaphone' },
    { id: 'exp-cat-software', name: 'Software & Tools', slug: 'software', color: '#8B5CF6', icon: 'Code' },
    { id: 'exp-cat-payroll', name: 'Payroll & Contractors', slug: 'payroll', color: '#EC4899', icon: 'Users' },
    { id: 'exp-cat-rent', name: 'Rent & Utilities', slug: 'rent-utilities', color: '#6366F1', icon: 'Building' },
    { id: 'exp-cat-fees', name: 'Payment Processing Fees', slug: 'payment-fees', color: '#EF4444', icon: 'CreditCard' },
    { id: 'exp-cat-other', name: 'Other Expenses', slug: 'other', color: '#6B7280', icon: 'DotsThree' },
  ]

  for (const cat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { id: cat.id },
      update: cat,
      create: { ...cat, sortOrder: expenseCategories.indexOf(cat) },
    })
    console.log(`   ✅ Category: ${cat.name}`)
  }
  console.log('')

  // ============================================
  // 7. BUDGETS
  // ============================================
  console.log('💰 Seeding Budgets...')
  const budgets = [
    { id: 'budget-marketing', categoryId: 'exp-cat-marketing', name: 'Monthly Marketing Budget', amount: 2000, period: 'MONTHLY' as const },
    { id: 'budget-shipping', categoryId: 'exp-cat-shipping', name: 'Monthly Shipping Budget', amount: 3000, period: 'MONTHLY' as const },
    { id: 'budget-software', categoryId: 'exp-cat-software', name: 'Monthly Software Budget', amount: 500, period: 'MONTHLY' as const },
  ]

  for (const budget of budgets) {
    await prisma.budget.upsert({
      where: { id: budget.id },
      update: budget,
      create: {
        ...budget,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        warningThreshold: 75,
        criticalThreshold: 90,
        isActive: true,
      },
    })
    console.log(`   ✅ Budget: ${budget.name} ($${budget.amount}/mo)`)
  }
  console.log('')

  // ============================================
  // 8. SALES GOALS
  // ============================================
  console.log('🎯 Seeding Sales Goals...')
  await prisma.salesGoals.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      dailyTarget: 750,
      weeklyTarget: 5000,
      monthlyTarget: 20000,
      quarterlyTarget: 60000,
      yearlyTarget: 240000,
    },
  })
  console.log('   ✅ Sales Goals configured\n')

  // ============================================
  // 9. ADMIN USERS
  // ============================================
  console.log('👤 Seeding Admin Users...')
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admins = [
    {
      id: 'admin-super',
      email: 'admin@headoverfeels.dev',
      name: 'Super Admin',
      password: adminPassword,
      role: 'SUPER_ADMIN' as const,
      isActive: true,
    },
    {
      id: 'admin-support',
      email: 'support@headoverfeels.dev',
      name: 'Support Manager',
      password: adminPassword,
      role: 'ADMIN' as const,
      isActive: true,
    },
  ]

  for (const admin of admins) {
    await prisma.adminUser.upsert({
      where: { id: admin.id },
      update: { ...admin, password: undefined }, // Don't update password
      create: admin,
    })
    console.log(`   ✅ Admin: ${admin.name} (${admin.email})`)
  }

  // Add admin availability
  for (const admin of admins) {
    await prisma.adminAvailability.upsert({
      where: { adminId: admin.id },
      update: {},
      create: {
        adminId: admin.id,
        isOnline: false,
        status: 'offline',
        maxChats: 3,
        activeChats: 0,
      },
    })
  }
  console.log('')

  // ============================================
  // 10. CATEGORIES (if not exist)
  // ============================================
  console.log('📁 Checking Categories...')
  const categories = [
    { id: 'cat-hoodies', name: 'Hoodies', slug: 'hoodies', description: 'Cozy hoodies for every mood' },
    { id: 'cat-tees', name: 'T-Shirts', slug: 't-shirts', description: 'Essential tees for everyday wear' },
    { id: 'cat-bottoms', name: 'Bottoms', slug: 'bottoms', description: 'Joggers, pants, and more' },
    { id: 'cat-accessories', name: 'Accessories', slug: 'accessories', description: 'Complete your look' },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: cat,
      create: { ...cat, sortOrder: categories.indexOf(cat), isActive: true },
    })
    console.log(`   ✅ Category: ${cat.name}`)
  }
  console.log('')

  // ============================================
  // 11. COLLECTIONS (if not exist)
  // ============================================
  console.log('🗂️  Checking Collections...')
  const collections = [
    { id: 'coll-new', name: 'New Arrivals', slug: 'new-arrivals', description: 'Fresh drops you\'ll love', isFeatured: true },
    { id: 'coll-best', name: 'Best Sellers', slug: 'best-sellers', description: 'Fan favorites', isFeatured: true },
    { id: 'coll-sale', name: 'Sale', slug: 'sale', description: 'Great deals on great fits' },
    { id: 'coll-limited', name: 'Limited Edition', slug: 'limited-edition', description: 'Exclusive drops, limited quantities' },
  ]

  for (const coll of collections) {
    await prisma.collection.upsert({
      where: { id: coll.id },
      update: coll,
      create: { ...coll, sortOrder: collections.indexOf(coll), isActive: true },
    })
    console.log(`   ✅ Collection: ${coll.name}`)
  }
  console.log('')

  // ============================================
  // 12. GIFT CARDS (Templates)
  // ============================================
  console.log('🎴 Seeding Gift Card Templates...')
  const giftCardTemplates = [
    {
      id: 'gc-template-25',
      code: 'GIFT25DEMO',
      initialBalance: 25,
      currentBalance: 25,
      status: 'ACTIVE' as const,
      recipientEmail: 'demo@example.com',
      recipientName: 'Demo User',
      senderName: 'Head Over Feels',
      personalMessage: 'Thanks for being awesome!',
    },
    {
      id: 'gc-template-50',
      code: 'GIFT50DEMO',
      initialBalance: 50,
      currentBalance: 50,
      status: 'ACTIVE' as const,
      recipientEmail: 'demo@example.com',
      recipientName: 'Demo User',
      senderName: 'Head Over Feels',
      personalMessage: 'Enjoy your shopping!',
    },
  ]

  for (const gc of giftCardTemplates) {
    await prisma.giftCard.upsert({
      where: { id: gc.id },
      update: gc,
      create: gc,
    })
    console.log(`   ✅ Gift Card: ${gc.code} ($${gc.initialBalance})`)
  }
  console.log('')

  // ============================================
  // SUMMARY
  // ============================================
  console.log('═'.repeat(50))
  console.log('✅ Part 1 Complete! Foundation data seeded:')
  console.log('   • Loyalty Settings')
  console.log('   • 4 Loyalty Tiers (Newcomer → Soulmate)')
  console.log('   • 6 Rewards (redeemable with Care Points)')
  console.log('   • 5 Promotions (including active promo codes)')
  console.log('   • 2 Points Multiplier Events')
  console.log('   • 8 Expense Categories')
  console.log('   • 3 Budgets')
  console.log('   • Sales Goals')
  console.log('   • 2 Admin Users')
  console.log('   • 4 Categories')
  console.log('   • 4 Collections')
  console.log('   • 2 Gift Cards')
  console.log('═'.repeat(50))
  console.log('\n🚀 Run Part 2 next: npx tsx scripts/seed-comprehensive-part2.ts')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
