/**
 * Comprehensive Seed Script
 * 
 * Seeds ALL tables: Loyalty Tiers, Rewards, Promotions, Customers, Orders,
 * Points Transactions, Redemptions, Reviews, Expenses, and more
 * 
 * Run: npx tsx scripts/seed-comprehensive.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Helper to generate random tracking events
function generateTrackingHistory(status: string) {
  const baseDate = new Date('2026-01-10T10:00:00Z')
  const events: Array<{ status: string; location: string; timestamp: string; description: string }> = []
  
  events.push({
    status: 'ORDER_PLACED',
    location: 'Online',
    timestamp: baseDate.toISOString(),
    description: 'Order placed successfully',
  })

  if (['PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
    events.push({
      status: 'PROCESSING',
      location: 'Los Angeles, CA',
      timestamp: new Date(baseDate.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      description: 'Order is being prepared',
    })
  }

  if (['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
    events.push({
      status: 'SHIPPED',
      location: 'Los Angeles, CA',
      timestamp: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      description: 'Package shipped via USPS',
    })
  }

  if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
    events.push({
      status: 'IN_TRANSIT',
      location: 'Phoenix, AZ',
      timestamp: new Date(baseDate.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      description: 'Package in transit',
    })
    events.push({
      status: 'IN_TRANSIT',
      location: 'Denver, CO',
      timestamp: new Date(baseDate.getTime() + 72 * 60 * 60 * 1000).toISOString(),
      description: 'Package arrived at regional facility',
    })
  }

  if (['OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
    events.push({
      status: 'OUT_FOR_DELIVERY',
      location: 'New York, NY',
      timestamp: new Date(baseDate.getTime() + 96 * 60 * 60 * 1000).toISOString(),
      description: 'Out for delivery',
    })
  }

  if (status === 'DELIVERED') {
    events.push({
      status: 'DELIVERED',
      location: 'New York, NY',
      timestamp: new Date(baseDate.getTime() + 100 * 60 * 60 * 1000).toISOString(),
      description: 'Delivered - Signed by CUSTOMER',
    })
  }

  return events
}

// Helper to generate order number
function generateOrderNumber(index: number): string {
  const prefix = 'HOF'
  const timestamp = '2601' // Jan 2026
  const sequence = String(index).padStart(4, '0')
  return `${prefix}-${timestamp}-${sequence}`
}

async function main() {
  console.log('🌱 Starting Comprehensive Database Seed...\n')
  console.log('═'.repeat(50))

  // ============================================
  // PART 1: FOUNDATION DATA
  // ============================================
  console.log('\n📦 PART 1: Foundation Data\n')

  // 1. LOYALTY SETTINGS
  console.log('⚙️  Seeding Loyalty Settings...')
  await prisma.loyaltySettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      isEnabled: true,
      programName: 'Care Points',
      pointsPerDollar: 10,
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

  // 2. LOYALTY TIERS
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

  // 3. REWARDS
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

  // 4. PROMOTIONS
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
      value: 0,
      code: null,
      autoApply: true,
      excludeFromLoyalty: false,
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

  // 5. POINTS MULTIPLIER EVENTS
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

  // 6. EXPENSE CATEGORIES
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

  // 7. BUDGETS
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

  // 8. SALES GOALS
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

  // 9. ADMIN USERS
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
      update: { ...admin, password: undefined },
      create: admin,
    })
    console.log(`   ✅ Admin: ${admin.name} (${admin.email})`)
  }

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

  // 10. CATEGORIES - Skip if they exist (names have unique constraint)
  console.log('📁 Checking Categories...')
  const existingCategories = await prisma.category.findMany()
  if (existingCategories.length === 0) {
    const categories = [
      { name: 'Hoodies', slug: 'hoodies', description: 'Cozy hoodies for every mood' },
      { name: 'T-Shirts', slug: 'tshirts', description: 'Essential tees for everyday wear' },
      { name: 'Bottoms', slug: 'bottoms', description: 'Joggers, pants, and more' },
      { name: 'Accessories', slug: 'accessories', description: 'Complete your look' },
    ]
    for (const cat of categories) {
      await prisma.category.create({
        data: { ...cat, sortOrder: categories.indexOf(cat), isActive: true },
      })
      console.log(`   ✅ Category: ${cat.name}`)
    }
  } else {
    console.log(`   ⏭️  ${existingCategories.length} categories already exist`)
  }
  console.log('')

  // 11. COLLECTIONS - Skip if they exist (names have unique constraint)
  console.log('🗂️  Checking Collections...')
  const existingCollections = await prisma.collection.findMany()
  if (existingCollections.length === 0) {
    const collections = [
      { name: 'New Arrivals', slug: 'new-arrivals', description: 'Fresh drops you\'ll love', isFeatured: true },
      { name: 'Best Sellers', slug: 'best-sellers', description: 'Fan favorites', isFeatured: true },
      { name: 'Sale', slug: 'sale', description: 'Great deals on great fits' },
      { name: 'Limited Edition', slug: 'limited-edition', description: 'Exclusive drops, limited quantities' },
    ]
    for (const coll of collections) {
      await prisma.collection.create({
        data: { ...coll, sortOrder: collections.indexOf(coll), isActive: true },
      })
      console.log(`   ✅ Collection: ${coll.name}`)
    }
  } else {
    console.log(`   ⏭️  ${existingCollections.length} collections already exist`)
  }
  console.log('')

  // 12. GIFT CARDS
  console.log('🎴 Seeding Gift Cards...')
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

  console.log('\n' + '═'.repeat(50))
  console.log('✅ Part 1 Complete!')
  console.log('═'.repeat(50))

  // ============================================
  // PART 2: TRANSACTIONAL DATA
  // ============================================
  console.log('\n📦 PART 2: Transactional Data\n')

  // Get existing products and variants
  const products = await prisma.product.findMany({
    include: { variants: true },
  })
  
  if (products.length === 0) {
    console.error('❌ No products found! Make sure products exist in the database.')
    process.exit(1)
  }
  console.log(`📦 Found ${products.length} products to use\n`)

  // 1. CUSTOMERS
  console.log('👥 Seeding Customers...')
  const customers = [
    {
      id: 'cust-emma',
      email: 'emma.johnson@email.com',
      name: 'Emma Johnson',
      phone: '+1-555-123-4567',
      loyaltyTierId: 'tier-soulmate',
      currentPoints: 4250,
      lifetimePoints: 12500,
      totalSpent: 1250,
      totalOrders: 8,
      avgOrderValue: 156.25,
      birthday: new Date('1992-03-15'),
      newsletter: true,
      smsOptIn: true,
    },
    {
      id: 'cust-alex',
      email: 'alex.chen@email.com',
      name: 'Alex Chen',
      phone: '+1-555-234-5678',
      loyaltyTierId: 'tier-bestie',
      currentPoints: 1850,
      lifetimePoints: 5500,
      totalSpent: 550,
      totalOrders: 5,
      avgOrderValue: 110,
      birthday: new Date('1995-08-22'),
      newsletter: true,
      smsOptIn: false,
    },
    {
      id: 'cust-jordan',
      email: 'jordan.taylor@email.com',
      name: 'Jordan Taylor',
      phone: '+1-555-345-6789',
      loyaltyTierId: 'tier-friend',
      currentPoints: 750,
      lifetimePoints: 1800,
      totalSpent: 180,
      totalOrders: 2,
      avgOrderValue: 90,
      birthday: new Date('1998-11-08'),
      newsletter: true,
      smsOptIn: true,
    },
    {
      id: 'cust-sam',
      email: 'sam.wilson@email.com',
      name: 'Sam Wilson',
      phone: '+1-555-456-7890',
      loyaltyTierId: 'tier-newcomer',
      currentPoints: 350,
      lifetimePoints: 350,
      totalSpent: 35,
      totalOrders: 1,
      avgOrderValue: 35,
      newsletter: false,
      smsOptIn: false,
    },
    {
      id: 'cust-riley',
      email: 'riley.morgan@email.com',
      name: 'Riley Morgan',
      phone: '+1-555-567-8901',
      loyaltyTierId: 'tier-bestie',
      currentPoints: 2100,
      lifetimePoints: 4200,
      totalSpent: 420,
      totalOrders: 4,
      avgOrderValue: 105,
      birthday: new Date('1994-06-30'),
      newsletter: true,
      smsOptIn: true,
    },
  ]

  for (const cust of customers) {
    await prisma.customer.upsert({
      where: { id: cust.id },
      update: cust,
      create: cust,
    })
    const tier = tiers.find(t => t.id === cust.loyaltyTierId)
    console.log(`   ✅ ${cust.name} - ${tier?.name} (${cust.currentPoints} pts)`)
  }
  console.log('')

  // 2. ADDRESSES
  console.log('📍 Seeding Addresses...')
  const addresses = [
    {
      id: 'addr-emma-ship',
      customerId: 'cust-emma',
      firstName: 'Emma',
      lastName: 'Johnson',
      address1: '123 Main Street',
      address2: 'Apt 4B',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
      isDefault: true,
    },
    {
      id: 'addr-alex-ship',
      customerId: 'cust-alex',
      firstName: 'Alex',
      lastName: 'Chen',
      address1: '456 Oak Avenue',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94102',
      country: 'US',
      isDefault: true,
    },
    {
      id: 'addr-jordan-ship',
      customerId: 'cust-jordan',
      firstName: 'Jordan',
      lastName: 'Taylor',
      address1: '789 Pine Road',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
      isDefault: true,
    },
    {
      id: 'addr-sam-ship',
      customerId: 'cust-sam',
      firstName: 'Sam',
      lastName: 'Wilson',
      address1: '321 Elm Street',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'US',
      isDefault: true,
    },
    {
      id: 'addr-riley-ship',
      customerId: 'cust-riley',
      firstName: 'Riley',
      lastName: 'Morgan',
      address1: '555 Cedar Lane',
      city: 'Denver',
      state: 'CO',
      postalCode: '80202',
      country: 'US',
      isDefault: true,
    },
  ]

  for (const addr of addresses) {
    await prisma.address.upsert({
      where: { id: addr.id },
      update: addr,
      create: addr,
    })
    console.log(`   ✅ ${addr.firstName} ${addr.lastName} - ${addr.city}, ${addr.state}`)
  }
  console.log('')

  // 3. REWARD REDEMPTIONS
  console.log('🎟️  Seeding Reward Redemptions...')
  const redemptions = [
    {
      id: 'redeem-emma-1',
      customerId: 'cust-emma',
      rewardId: 'reward-25off',
      pointsSpent: 2000,
      couponCode: 'REDEEM-EMMA-25OFF',
      idempotencyKey: 'idempkey-redeem-emma-1',
      status: 'USED' as const,
      usedAt: new Date('2026-01-12'),
    },
    {
      id: 'redeem-alex-1',
      customerId: 'cust-alex',
      rewardId: 'reward-10off',
      pointsSpent: 1000,
      couponCode: 'REDEEM-ALEX-10OFF',
      idempotencyKey: 'idempkey-redeem-alex-1',
      status: 'USED' as const,
      usedAt: new Date('2026-01-14'),
    },
    {
      id: 'redeem-riley-1',
      customerId: 'cust-riley',
      rewardId: 'reward-freeship',
      pointsSpent: 300,
      couponCode: 'REDEEM-RILEY-SHIP',
      idempotencyKey: 'idempkey-redeem-riley-1',
      status: 'ACTIVE' as const,
    },
  ]

  for (const redeem of redemptions) {
    await prisma.rewardRedemption.upsert({
      where: { id: redeem.id },
      update: redeem,
      create: redeem,
    })
    const reward = rewards.find(r => r.id === redeem.rewardId)
    console.log(`   ✅ ${redeem.couponCode} - ${reward?.name} (${redeem.status})`)
  }
  console.log('')

  // 4. ORDERS
  console.log('📦 Seeding Orders...')
  const hoodie = products.find(p => p.name.toLowerCase().includes('hoodie'))
  const tee = products.find(p => p.name.toLowerCase().includes('tee'))
  const joggers = products.find(p => p.name.toLowerCase().includes('jogger'))
  const tote = products.find(p => p.name.toLowerCase().includes('tote'))

  const ordersData = [
    {
      id: 'order-emma-1',
      orderNumber: generateOrderNumber(1001),
      customerId: 'cust-emma',
      customerEmail: 'emma.johnson@email.com',
      status: 'DELIVERED' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: hoodie?.id || products[0].id, productVariantId: hoodie?.variants[0]?.id || products[0].variants[0]?.id, quantity: 1, price: 89.99 },
        { productId: tee?.id || products[3]?.id, productVariantId: tee?.variants[0]?.id || products[3]?.variants[0]?.id, quantity: 2, price: 34.99 },
      ],
      subtotal: 159.97,
      discount: 25,
      couponCode: 'REDEEM-EMMA-25OFF',
      redemptionId: 'redeem-emma-1',
      shipping: 0,
      tax: 12.80,
      total: 147.77,
      trackingNumber: '9400111899223456789012',
      carrier: 'USPS',
      estimatedDelivery: new Date('2026-01-15'),
      shippingMethod: 'Express',
      shippingAddressId: 'addr-emma-ship',
      billingAddressId: 'addr-emma-ship',
      pointsEarned: 320,
      pointsRedeemed: 2000,
      promotionApplied: null,
    },
    {
      id: 'order-alex-1',
      orderNumber: generateOrderNumber(1002),
      customerId: 'cust-alex',
      customerEmail: 'alex.chen@email.com',
      status: 'SHIPPED' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: hoodie?.id || products[0].id, productVariantId: hoodie?.variants[1]?.id || products[0].variants[1]?.id, quantity: 1, price: 89.99 },
        { productId: joggers?.id || products[6]?.id, productVariantId: joggers?.variants[0]?.id || products[6]?.variants[0]?.id, quantity: 1, price: 69.99 },
      ],
      subtotal: 159.98,
      discount: 42,
      couponCode: 'WINTER20',
      redemptionId: 'redeem-alex-1',
      shipping: 0,
      tax: 9.44,
      total: 127.42,
      trackingNumber: '9400111899223456789013',
      carrier: 'USPS',
      estimatedDelivery: new Date('2026-01-18'),
      shippingMethod: 'Standard',
      shippingAddressId: 'addr-alex-ship',
      billingAddressId: 'addr-alex-ship',
      pointsEarned: 240,
      pointsRedeemed: 1000,
      promotionApplied: 'WINTER20 (20% off)',
    },
    {
      id: 'order-jordan-1',
      orderNumber: generateOrderNumber(1003),
      customerId: 'cust-jordan',
      customerEmail: 'jordan.taylor@email.com',
      status: 'SHIPPED' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: tee?.id || products[3]?.id, productVariantId: tee?.variants[2]?.id || products[3]?.variants[2]?.id, quantity: 3, price: 34.99 },
      ],
      subtotal: 104.97,
      discount: 15.75,
      couponCode: 'WELCOME15',
      shipping: 7.99,
      tax: 7.14,
      total: 104.35,
      trackingNumber: '9400111899223456789014',
      carrier: 'USPS',
      estimatedDelivery: new Date('2026-01-20'),
      shippingMethod: 'Standard',
      shippingAddressId: 'addr-jordan-ship',
      billingAddressId: 'addr-jordan-ship',
      pointsEarned: 131,
      pointsRedeemed: 0,
      promotionApplied: 'WELCOME15 (15% off)',
    },
    {
      id: 'order-sam-1',
      orderNumber: generateOrderNumber(1004),
      customerId: 'cust-sam',
      customerEmail: 'sam.wilson@email.com',
      status: 'PROCESSING' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: tee?.id || products[3]?.id, productVariantId: tee?.variants[0]?.id || products[3]?.variants[0]?.id, quantity: 1, price: 34.99 },
      ],
      subtotal: 34.99,
      discount: 0,
      shipping: 5.99,
      tax: 2.80,
      total: 43.78,
      trackingNumber: null,
      carrier: null,
      estimatedDelivery: new Date('2026-01-22'),
      shippingMethod: 'Standard',
      shippingAddressId: 'addr-sam-ship',
      billingAddressId: 'addr-sam-ship',
      pointsEarned: 35,
      pointsRedeemed: 0,
      promotionApplied: null,
    },
    {
      id: 'order-riley-1',
      orderNumber: generateOrderNumber(1005),
      customerId: 'cust-riley',
      customerEmail: 'riley.morgan@email.com',
      status: 'SHIPPED' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: hoodie?.id || products[0].id, productVariantId: hoodie?.variants[2]?.id || products[0].variants[2]?.id, quantity: 1, price: 99.99 },
        { productId: tote?.id || products[8]?.id, productVariantId: tote?.variants[0]?.id || products[8]?.variants[0]?.id, quantity: 1, price: 39.99 },
      ],
      subtotal: 139.98,
      discount: 0,
      shipping: 0,
      tax: 11.20,
      total: 151.18,
      trackingNumber: '9400111899223456789015',
      carrier: 'UPS',
      estimatedDelivery: new Date('2026-01-16'),
      shippingMethod: 'Express',
      shippingAddressId: 'addr-riley-ship',
      billingAddressId: 'addr-riley-ship',
      pointsEarned: 210,
      pointsRedeemed: 0,
      promotionApplied: 'Free Shipping (Bestie Tier)',
    },
  ]

  for (const orderData of ordersData) {
    const { items, promotionApplied, pointsEarned, pointsRedeemed, ...orderFields } = orderData
    
    await prisma.order.upsert({
      where: { id: orderData.id },
      update: orderFields,
      create: orderFields,
    })

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const product = products.find(p => p.id === item.productId) || products[0]
      const variant = product.variants.find(v => v.id === item.productVariantId) || product.variants[0]
      
      await prisma.orderItem.upsert({
        where: { id: `${orderData.id}-item-${i}` },
        update: {},
        create: {
          id: `${orderData.id}-item-${i}`,
          orderId: orderData.id,
          productId: product.id,
          productVariantId: variant?.id,
          productName: product.name,
          productImage: product.images?.[0] || null,
          variantDetails: variant?.name || `${variant?.size || ''} ${variant?.color || ''}`.trim(),
          quantity: item.quantity,
          price: item.price,
        },
      })
    }

    const cust = customers.find(c => c.id === orderData.customerId)
    console.log(`   ✅ ${orderData.orderNumber} - ${cust?.name} (${orderData.status})`)
    console.log(`      💰 $${orderData.total.toFixed(2)} | 🎁 -$${orderData.discount} | 🌟 +${pointsEarned} pts`)
    if (promotionApplied) {
      console.log(`      🏷️  Promo: ${promotionApplied}`)
    }
    if (pointsRedeemed > 0) {
      console.log(`      🎟️  Redeemed: ${pointsRedeemed} pts`)
    }
  }
  console.log('')

  // 5. POINTS TRANSACTIONS
  console.log('💎 Seeding Points Transactions...')
  const pointsTransactions = [
    { id: 'pts-emma-earn-1', customerId: 'cust-emma', orderId: 'order-emma-1', points: 320, type: 'PURCHASE' as const, description: 'Points earned from order HOF-2601-1001 (2x Soulmate bonus)' },
    { id: 'pts-emma-redeem-1', customerId: 'cust-emma', orderId: 'order-emma-1', points: -2000, type: 'REDEMPTION' as const, description: 'Redeemed $25 Off reward on order HOF-2601-1001' },
    { id: 'pts-emma-review-1', customerId: 'cust-emma', points: 75, type: 'REVIEW' as const, description: 'Points earned for writing a review with photo' },
    { id: 'pts-alex-earn-1', customerId: 'cust-alex', orderId: 'order-alex-1', points: 240, type: 'PURCHASE' as const, description: 'Points earned from order HOF-2601-1002 (1.5x Bestie bonus)' },
    { id: 'pts-alex-redeem-1', customerId: 'cust-alex', orderId: 'order-alex-1', points: -1000, type: 'REDEMPTION' as const, description: 'Redeemed $10 Off reward on order HOF-2601-1002' },
    { id: 'pts-jordan-earn-1', customerId: 'cust-jordan', orderId: 'order-jordan-1', points: 131, type: 'PURCHASE' as const, description: 'Points earned from order HOF-2601-1003 (1.25x Friend bonus)' },
    { id: 'pts-jordan-signup', customerId: 'cust-jordan', points: 100, type: 'ACCOUNT_CREATION' as const, description: 'Welcome bonus for joining Care Points program' },
    { id: 'pts-sam-earn-1', customerId: 'cust-sam', orderId: 'order-sam-1', points: 35, type: 'PURCHASE' as const, description: 'Points earned from order HOF-2601-1004' },
    { id: 'pts-sam-signup', customerId: 'cust-sam', points: 100, type: 'ACCOUNT_CREATION' as const, description: 'Welcome bonus for joining Care Points program' },
    { id: 'pts-riley-earn-1', customerId: 'cust-riley', orderId: 'order-riley-1', points: 210, type: 'PURCHASE' as const, description: 'Points earned from order HOF-2601-1005 (1.5x Bestie bonus)' },
    { id: 'pts-riley-referral', customerId: 'cust-riley', points: 500, type: 'REFERRAL_GIVE' as const, description: 'Referral bonus - referred a new customer' },
  ]

  for (const tx of pointsTransactions) {
    await prisma.pointsTransaction.upsert({
      where: { id: tx.id },
      update: tx,
      create: tx,
    })
    const sign = tx.points > 0 ? '+' : ''
    console.log(`   ✅ ${tx.type}: ${sign}${tx.points} pts`)
  }
  console.log('')

  // 6. REVIEWS
  console.log('⭐ Seeding Reviews...')
  const reviews = [
    {
      id: 'review-emma-1',
      productId: hoodie?.id || products[0].id,
      customerId: 'cust-emma',
      customerName: 'Emma J.',
      customerEmail: 'emma.johnson@email.com',
      rating: 5,
      title: 'Absolutely love it!',
      comment: 'This hoodie is so comfortable and the quality is amazing. The fit is perfect and I\'ve already gotten so many compliments. Worth every penny!',
      isVerified: true,
      status: 'APPROVED' as const,
      helpfulCount: 12,
      images: JSON.stringify(['https://example.com/review-emma-1.jpg']),
    },
    {
      id: 'review-alex-1',
      productId: joggers?.id || products[6]?.id,
      customerId: 'cust-alex',
      customerName: 'Alex C.',
      customerEmail: 'alex.chen@email.com',
      rating: 4,
      title: 'Great joggers, runs slightly large',
      comment: 'Really comfortable and stylish. Only giving 4 stars because they run a bit large - I\'d recommend sizing down.',
      isVerified: true,
      status: 'APPROVED' as const,
      helpfulCount: 8,
    },
    {
      id: 'review-riley-1',
      productId: tote?.id || products[8]?.id,
      customerId: 'cust-riley',
      customerName: 'Riley M.',
      customerEmail: 'riley.morgan@email.com',
      rating: 5,
      title: 'Perfect everyday bag',
      comment: 'Love the size and quality of this tote. It fits everything I need and looks great with any outfit.',
      isVerified: true,
      status: 'APPROVED' as const,
      helpfulCount: 5,
    },
  ]

  for (const review of reviews) {
    await prisma.review.upsert({
      where: { id: review.id },
      update: review,
      create: review,
    })
    console.log(`   ✅ ${review.customerName}: ${review.rating}★ - "${review.title}"`)
  }
  console.log('')

  // 7. WISHLISTS
  console.log('❤️  Seeding Wishlists...')
  const wishlists = [
    { id: 'wish-emma-1', customerId: 'cust-emma', productId: products[9]?.id || products[0].id },
    { id: 'wish-emma-2', customerId: 'cust-emma', productId: joggers?.id || products[6]?.id },
    { id: 'wish-alex-1', customerId: 'cust-alex', productId: tote?.id || products[8]?.id },
    { id: 'wish-jordan-1', customerId: 'cust-jordan', productId: hoodie?.id || products[0].id },
  ]

  for (const wish of wishlists) {
    await prisma.wishlistItem.upsert({
      where: { id: wish.id },
      update: wish,
      create: wish,
    })
  }
  console.log(`   ✅ ${wishlists.length} wishlist items added\n`)

  // 8. EXPENSES
  console.log('📊 Seeding Expenses...')
  const expenses = [
    { id: 'exp-inv-jan', categoryId: 'exp-cat-inventory', description: 'Hoodie inventory restock - January', amount: 2500, date: new Date('2026-01-05'), vendor: 'Premium Apparel Co', paymentMethod: 'Bank Transfer', isRecurring: false },
    { id: 'exp-ship-jan', categoryId: 'exp-cat-shipping', description: 'USPS shipping costs - Week 1', amount: 450, date: new Date('2026-01-08'), vendor: 'USPS', paymentMethod: 'Credit Card', isRecurring: false },
    { id: 'exp-ads-jan', categoryId: 'exp-cat-marketing', description: 'Instagram ads - January campaign', amount: 800, date: new Date('2026-01-01'), vendor: 'Meta Ads', paymentMethod: 'Credit Card', isRecurring: true },
    { id: 'exp-soft-jan', categoryId: 'exp-cat-software', description: 'Monthly SaaS subscriptions', amount: 299, date: new Date('2026-01-01'), vendor: 'Various', paymentMethod: 'Credit Card', isRecurring: true, notes: 'Includes Vercel, Stripe, Cloudinary, etc.' },
  ]

  for (const exp of expenses) {
    await prisma.expense.upsert({
      where: { id: exp.id },
      update: exp,
      create: exp,
    })
    console.log(`   ✅ $${exp.amount} - ${exp.description}`)
  }
  console.log('')

  // 9. DROP NOTIFICATIONS
  console.log('🔔 Seeding Drop Notifications...')
  const limitedProduct = await prisma.product.findFirst({ where: { isLimitedEdition: true } })
  
  if (limitedProduct) {
    const notificationSignups = [
      { id: 'notify-emma', productId: limitedProduct.id, email: 'emma.johnson@email.com', source: 'product-page' },
      { id: 'notify-alex', productId: limitedProduct.id, email: 'alex.chen@email.com', source: 'homepage-banner' },
      { id: 'notify-riley', productId: limitedProduct.id, email: 'riley.morgan@email.com', source: 'product-page' },
    ]

    for (const signup of notificationSignups) {
      await prisma.dropNotification.upsert({
        where: { id: signup.id },
        update: signup,
        create: signup,
      })
    }
    console.log(`   ✅ ${notificationSignups.length} drop notification signups\n`)
  } else {
    console.log('   ⚠️  No limited edition product found - skipping notifications\n')
  }

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log('═'.repeat(50))
  console.log('🎉 COMPREHENSIVE SEED COMPLETE!')
  console.log('═'.repeat(50))
  console.log('\n📋 Foundation Data:')
  console.log('   • Loyalty Settings (Care Points program)')
  console.log('   • 4 Loyalty Tiers (Newcomer → Soulmate)')
  console.log('   • 6 Rewards (redeemable with points)')
  console.log('   • 5 Promotions (WELCOME15, WINTER20, etc.)')
  console.log('   • 2 Points Multiplier Events')
  console.log('   • 8 Expense Categories')
  console.log('   • 3 Budgets')
  console.log('   • Sales Goals')
  console.log('   • 2 Admin Users')
  console.log('   • 4 Categories')
  console.log('   • 4 Collections')
  console.log('   • 2 Gift Cards')
  console.log('\n📋 Transactional Data:')
  console.log('   • 5 Customers with loyalty tiers')
  console.log('   • 5 Addresses')
  console.log('   • 3 Reward Redemptions')
  console.log('   • 5 Orders with real products')
  console.log('   • 11 Points Transactions')
  console.log('   • 3 Product Reviews')
  console.log('   • 4 Wishlist Items')
  console.log('   • 4 Expenses')
  console.log('\n📦 Test Orders:')
  console.log('   HOF-2601-1001: Emma (Soulmate) - DELIVERED')
  console.log('      → $25 redemption, 320 pts earned (2x)')
  console.log('   HOF-2601-1002: Alex (Bestie) - IN_TRANSIT')
  console.log('      → WINTER20 + $10 redemption, 240 pts')
  console.log('   HOF-2601-1003: Jordan (Friend) - SHIPPED')
  console.log('      → WELCOME15 promo, 131 pts')
  console.log('   HOF-2601-1004: Sam (Newcomer) - PROCESSING')
  console.log('      → No promo, 35 pts')
  console.log('   HOF-2601-1005: Riley (Bestie) - OUT_FOR_DELIVERY')
  console.log('      → Free shipping tier perk, 210 pts')
  console.log('\n🔗 Test URLs:')
  console.log('   http://localhost:3000/order/track/HOF-2601-1001')
  console.log('   http://localhost:3000/order/track/HOF-2601-1002')
  console.log('   http://localhost:3000/order/track/HOF-2601-1003')
  console.log('   http://localhost:3000/order/track/HOF-2601-1004')
  console.log('   http://localhost:3000/order/track/HOF-2601-1005')
  console.log('')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
