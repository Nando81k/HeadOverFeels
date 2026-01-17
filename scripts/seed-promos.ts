/**
 * Seed Promotions and Popups
 * 
 * Quick script to add promotions and marketing popups
 * Run with: npx tsx scripts/seed-promos.ts
 */

import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'

const prisma = new PrismaClient()

function generateId(): string {
  return faker.string.uuid()
}

async function main() {
  console.log('🎁 Seeding Promotions and Popups...\n')

  // ============================================
  // PROMOTIONS
  // ============================================
  console.log('Creating promotions...')
  
  const promotions = [
    {
      id: 'promo-welcome15',
      name: 'Welcome 15% Off',
      description: 'Get 15% off your first purchase when you sign up!',
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
      description: 'Free standard shipping on orders $75+',
      type: 'FREE_SHIPPING' as const,
      value: 0,
      code: null,
      autoApply: true,
      minimumPurchase: 75,
      maxUsesPerCustomer: null,
      isActive: true,
      stackable: true,
    },
    {
      id: 'promo-summer20',
      name: 'Summer Sale 20% Off',
      description: 'Celebrate summer with 20% off sitewide!',
      type: 'PERCENTAGE' as const,
      value: 20,
      code: 'SUMMER20',
      autoApply: false,
      minimumPurchase: null,
      maxUsesTotal: 500,
      maxUsesPerCustomer: 2,
      usedCount: 127,
      isActive: true,
      stackable: false,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    },
    {
      id: 'promo-bogo-tees',
      name: 'Buy One Get One 50% Off Tees',
      description: 'Buy any tee, get a second one 50% off!',
      type: 'BOGO' as const,
      value: 50,
      code: 'BOGO50',
      autoApply: false,
      minimumPurchase: null,
      maxUsesPerCustomer: 3,
      isActive: true,
      stackable: false,
    },
    {
      id: 'promo-vip25',
      name: 'VIP Exclusive 25% Off',
      description: 'Exclusive discount for our Soulmate tier members',
      type: 'PERCENTAGE' as const,
      value: 25,
      code: 'VIP25',
      autoApply: false,
      minimumPurchase: 100,
      maxUsesPerCustomer: 1,
      isActive: true,
      stackable: false,
      excludeFromLoyalty: false,
    },
    {
      id: 'promo-flash10',
      name: 'Flash Sale $10 Off',
      description: 'Limited time - $10 off any order over $40',
      type: 'FIXED_AMOUNT' as const,
      value: 10,
      code: 'FLASH10',
      autoApply: false,
      minimumPurchase: 40,
      maxUsesTotal: 200,
      maxUsesPerCustomer: 1,
      usedCount: 89,
      isActive: true,
      stackable: false,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    {
      id: 'promo-stay10',
      name: 'Don\'t Leave - 10% Off',
      description: 'Special offer for customers who almost left!',
      type: 'PERCENTAGE' as const,
      value: 10,
      code: 'STAY10',
      autoApply: false,
      minimumPurchase: null,
      maxUsesPerCustomer: 1,
      isActive: true,
      stackable: false,
    },
  ]

  for (const promo of promotions) {
    await prisma.promotion.upsert({
      where: { id: promo.id },
      update: promo,
      create: promo,
    })
    console.log(`   ✅ ${promo.name} (${promo.code || 'auto-apply'})`)
  }

  // ============================================
  // MARKETING POPUPS
  // ============================================
  console.log('\nCreating marketing popups...')

  const popups = [
    {
      id: 'popup-welcome-discount',
      name: 'Welcome Discount Popup',
      template: 'MODAL' as const,
      position: 'CENTER' as const,
      content: JSON.stringify({
        title: 'Welcome to Head Over Feels! 💙',
        subtitle: 'Join our community and get 15% off your first order',
        body: 'Sign up to receive exclusive deals, new drop alerts, and 15% off your first purchase.',
        buttonText: 'Get 15% Off',
        buttonAction: 'signup',
        image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80',
        discountCode: 'WELCOME15',
        backgroundColor: '#000000',
        textColor: '#ffffff',
        accentColor: '#FF3131',
      }),
      triggerType: 'DELAY' as const,
      triggerValue: 5, // Show after 5 seconds
      showOnPages: 'all',
      showToNewVisitors: true,
      showToReturning: false,
      frequency: 'ONCE_EVER' as const,
      isActive: true,
      priority: 10,
      promotionId: 'promo-welcome15',
    },
    {
      id: 'popup-exit-intent',
      name: 'Exit Intent - Don\'t Leave Empty Handed',
      template: 'MODAL' as const,
      position: 'CENTER' as const,
      content: JSON.stringify({
        title: 'Wait! Don\'t Leave Yet! 🛍️',
        subtitle: 'Here\'s 10% off to sweeten the deal',
        body: 'Complete your purchase now and save 10% with code STAY10',
        buttonText: 'Claim My Discount',
        buttonAction: 'copy_code',
        discountCode: 'STAY10',
        backgroundColor: '#1a1a1a',
        textColor: '#ffffff',
        accentColor: '#FF3131',
      }),
      triggerType: 'EXIT_INTENT' as const,
      triggerValue: 0,
      showOnPages: '/cart,/products',
      showToNewVisitors: true,
      showToReturning: true,
      frequency: 'ONCE_PER_SESSION' as const,
      isActive: true,
      priority: 5,
      promotionId: 'promo-stay10',
    },
    {
      id: 'popup-summer-sale-banner',
      name: 'Summer Sale Announcement Banner',
      template: 'BANNER' as const,
      position: 'TOP' as const,
      content: JSON.stringify({
        title: '☀️ Summer Sale - 20% Off Sitewide!',
        body: 'Use code SUMMER20 at checkout',
        buttonText: 'Shop Now',
        buttonAction: 'navigate',
        buttonLink: '/collections/all',
        backgroundColor: '#FF3131',
        textColor: '#ffffff',
        dismissible: true,
      }),
      triggerType: 'IMMEDIATE' as const,
      triggerValue: 0,
      showOnPages: 'all',
      showToNewVisitors: true,
      showToReturning: true,
      frequency: 'ONCE_PER_DAY' as const,
      isActive: true,
      priority: 1,
      promotionId: 'promo-summer20',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    },
    {
      id: 'popup-newsletter-slide',
      name: 'Newsletter Slide-In',
      template: 'SLIDE_IN' as const,
      position: 'BOTTOM_RIGHT' as const,
      content: JSON.stringify({
        title: 'Stay in the Loop 📬',
        body: 'Get notified about new drops, exclusive deals, and behind-the-scenes content.',
        buttonText: 'Subscribe',
        buttonAction: 'newsletter_signup',
        inputPlaceholder: 'Enter your email',
        backgroundColor: '#ffffff',
        textColor: '#1a1a1a',
        accentColor: '#FF3131',
      }),
      triggerType: 'SCROLL' as const,
      triggerValue: 50, // Show after 50% scroll
      showOnPages: '/products,/collections',
      showToNewVisitors: true,
      showToReturning: true,
      frequency: 'ONCE_PER_SESSION' as const,
      isActive: true,
      priority: 3,
      promotionId: null,
    },
    {
      id: 'popup-flash-sale',
      name: 'Flash Sale Countdown',
      template: 'MODAL' as const,
      position: 'CENTER' as const,
      content: JSON.stringify({
        title: '⚡ Flash Sale!',
        subtitle: '$10 off orders over $40',
        body: 'Limited time offer - ends soon!',
        buttonText: 'Shop the Sale',
        buttonAction: 'navigate',
        buttonLink: '/products',
        discountCode: 'FLASH10',
        showCountdown: true,
        countdownEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        backgroundColor: '#000000',
        textColor: '#ffffff',
        accentColor: '#FFD700',
      }),
      triggerType: 'DELAY' as const,
      triggerValue: 10, // Show after 10 seconds
      showOnPages: 'all',
      showToNewVisitors: true,
      showToReturning: true,
      frequency: 'ONCE_PER_DAY' as const,
      isActive: true,
      priority: 8,
      promotionId: 'promo-flash10',
    },
  ]

  for (const popup of popups) {
    await prisma.marketingPopup.upsert({
      where: { id: popup.id },
      update: popup,
      create: popup,
    })
    console.log(`   ✅ ${popup.name} (${popup.template})`)
  }

  // ============================================
  // POPUP ANALYTICS
  // ============================================
  console.log('\nCreating popup analytics...')

  for (const popup of popups) {
    // Generate analytics for the past 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      try {
        await prisma.popupAnalytics.upsert({
          where: {
            popupId_variantId_date: {
              popupId: popup.id,
              variantId: null,
              date,
            },
          },
          update: {
            impressions: faker.number.int({ min: 50, max: 500 }),
            clicks: faker.number.int({ min: 10, max: 100 }),
            dismissals: faker.number.int({ min: 20, max: 150 }),
            conversions: faker.number.int({ min: 2, max: 30 }),
          },
          create: {
            id: generateId(),
            popupId: popup.id,
            date,
            impressions: faker.number.int({ min: 50, max: 500 }),
            clicks: faker.number.int({ min: 10, max: 100 }),
            dismissals: faker.number.int({ min: 20, max: 150 }),
            conversions: faker.number.int({ min: 2, max: 30 }),
          },
        })
      } catch {
        // Skip if exists
      }
    }
  }
  console.log('   ✅ Created 7 days of analytics for each popup')

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '═'.repeat(50))
  console.log('🎉 SEED COMPLETE!')
  console.log('═'.repeat(50))
  
  const promoCount = await prisma.promotion.count()
  const popupCount = await prisma.marketingPopup.count()
  const analyticsCount = await prisma.popupAnalytics.count()
  
  console.log(`\n📊 Created:`)
  console.log(`   • ${promoCount} Promotions`)
  console.log(`   • ${popupCount} Marketing Popups`)
  console.log(`   • ${analyticsCount} Popup Analytics records`)
  
  console.log('\n🏷️ Promo Codes:')
  console.log('   • WELCOME15 - 15% off first purchase (min $50)')
  console.log('   • SUMMER20 - 20% off sitewide')
  console.log('   • BOGO50 - Buy one get one 50% off')
  console.log('   • VIP25 - 25% off for VIP members (min $100)')
  console.log('   • FLASH10 - $10 off (min $40)')
  console.log('   • STAY10 - 10% off (exit intent)')
  console.log('   • Auto: Free shipping over $75')
  
  console.log('\n📢 Active Popups:')
  console.log('   • Welcome Modal - 15% off for new visitors')
  console.log('   • Exit Intent Modal - 10% off when leaving')
  console.log('   • Summer Sale Banner - Top announcement')
  console.log('   • Newsletter Slide-in - Email capture')
  console.log('   • Flash Sale Modal - Limited time offer')
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
