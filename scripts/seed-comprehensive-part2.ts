/**
 * Comprehensive Seed Script - Part 2: Transactional Data
 * 
 * Seeds: Customers, Addresses, Orders with real products, OrderItems,
 * Points Transactions, Reward Redemptions, Reviews, Tracking Data
 */

import { PrismaClient } from '@prisma/client'

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
  console.log('🌱 Starting Comprehensive Seed - Part 2: Transactional Data...\n')

  // Get existing products and variants
  const products = await prisma.product.findMany({
    include: { variants: true },
  })
  
  if (products.length === 0) {
    console.error('❌ No products found! Make sure products exist in the database.')
    process.exit(1)
  }
  console.log(`📦 Found ${products.length} products to use\n`)

  // Get loyalty tiers
  const tiers = await prisma.loyaltyTier.findMany({ orderBy: { sortOrder: 'asc' } })
  if (tiers.length === 0) {
    console.error('❌ No loyalty tiers found! Run Part 1 first.')
    process.exit(1)
  }

  // Get rewards
  const rewards = await prisma.reward.findMany()

  // ============================================
  // 1. CUSTOMERS WITH LOYALTY STATUS
  // ============================================
  console.log('👥 Seeding Customers...')
  
  const customers = [
    {
      id: 'cust-emma',
      email: 'emma.johnson@email.com',
      firstName: 'Emma',
      lastName: 'Johnson',
      phone: '+1-555-123-4567',
      loyaltyTierId: 'tier-soulmate',
      currentPoints: 4250,
      lifetimePoints: 12500,
      totalSpent: 1250,
      totalOrders: 8,
      averageOrderValue: 156.25,
      birthday: new Date('1992-03-15'),
      marketingConsent: true,
      smsConsent: true,
    },
    {
      id: 'cust-alex',
      email: 'alex.chen@email.com',
      firstName: 'Alex',
      lastName: 'Chen',
      phone: '+1-555-234-5678',
      loyaltyTierId: 'tier-bestie',
      currentPoints: 1850,
      lifetimePoints: 5500,
      totalSpent: 550,
      totalOrders: 5,
      averageOrderValue: 110,
      birthday: new Date('1995-08-22'),
      marketingConsent: true,
      smsConsent: false,
    },
    {
      id: 'cust-jordan',
      email: 'jordan.taylor@email.com',
      firstName: 'Jordan',
      lastName: 'Taylor',
      phone: '+1-555-345-6789',
      loyaltyTierId: 'tier-friend',
      currentPoints: 750,
      lifetimePoints: 1800,
      totalSpent: 180,
      totalOrders: 2,
      averageOrderValue: 90,
      birthday: new Date('1998-11-08'),
      marketingConsent: true,
      smsConsent: true,
    },
    {
      id: 'cust-sam',
      email: 'sam.wilson@email.com',
      firstName: 'Sam',
      lastName: 'Wilson',
      phone: '+1-555-456-7890',
      loyaltyTierId: 'tier-newcomer',
      currentPoints: 350,
      lifetimePoints: 350,
      totalSpent: 35,
      totalOrders: 1,
      averageOrderValue: 35,
      marketingConsent: false,
      smsConsent: false,
    },
    {
      id: 'cust-riley',
      email: 'riley.morgan@email.com',
      firstName: 'Riley',
      lastName: 'Morgan',
      phone: '+1-555-567-8901',
      loyaltyTierId: 'tier-bestie',
      currentPoints: 2100,
      lifetimePoints: 4200,
      totalSpent: 420,
      totalOrders: 4,
      averageOrderValue: 105,
      birthday: new Date('1994-06-30'),
      marketingConsent: true,
      smsConsent: true,
    },
  ]

  for (const cust of customers) {
    await prisma.customer.upsert({
      where: { id: cust.id },
      update: cust,
      create: cust,
    })
    const tier = tiers.find(t => t.id === cust.loyaltyTierId)
    console.log(`   ✅ ${cust.firstName} ${cust.lastName} - ${tier?.name} (${cust.currentPoints} pts)`)
  }
  console.log('')

  // ============================================
  // 2. ADDRESSES
  // ============================================
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
      phone: '+1-555-123-4567',
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
      phone: '+1-555-234-5678',
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
      phone: '+1-555-345-6789',
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
      phone: '+1-555-456-7890',
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
      phone: '+1-555-567-8901',
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

  // ============================================
  // 3. REWARD REDEMPTIONS
  // ============================================
  console.log('🎟️  Seeding Reward Redemptions...')
  const redemptions = [
    {
      id: 'redeem-emma-1',
      customerId: 'cust-emma',
      rewardId: 'reward-25off',
      pointsSpent: 2000,
      couponCode: 'REDEEM-EMMA-25OFF',
      status: 'USED' as const,
      usedAt: new Date('2026-01-12'),
    },
    {
      id: 'redeem-alex-1',
      customerId: 'cust-alex',
      rewardId: 'reward-10off',
      pointsSpent: 1000,
      couponCode: 'REDEEM-ALEX-10OFF',
      status: 'USED' as const,
      usedAt: new Date('2026-01-14'),
    },
    {
      id: 'redeem-riley-1',
      customerId: 'cust-riley',
      rewardId: 'reward-freeship',
      pointsSpent: 300,
      couponCode: 'REDEEM-RILEY-SHIP',
      status: 'ACTIVE' as const, // Available to use
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

  // ============================================
  // 4. ORDERS WITH REAL PRODUCTS
  // ============================================
  console.log('📦 Seeding Orders...')

  // Get some real products
  const hoodie = products.find(p => p.name.toLowerCase().includes('hoodie'))
  const tee = products.find(p => p.name.toLowerCase().includes('tee'))
  const joggers = products.find(p => p.name.toLowerCase().includes('jogger'))
  const tote = products.find(p => p.name.toLowerCase().includes('tote'))

  const ordersData = [
    {
      // Emma's order - DELIVERED, used $25 redemption, earned 2x points (Soulmate)
      id: 'order-emma-1',
      orderNumber: generateOrderNumber(1001),
      customerId: 'cust-emma',
      email: 'emma.johnson@email.com',
      status: 'DELIVERED' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: hoodie?.id || products[0].id, variantId: hoodie?.variants[0]?.id || products[0].variants[0]?.id, quantity: 1, price: 89.99 },
        { productId: tee?.id || products[3]?.id, variantId: tee?.variants[0]?.id || products[3]?.variants[0]?.id, quantity: 2, price: 34.99 },
      ],
      subtotal: 159.97,
      discount: 25, // Used $25 redemption
      couponCode: 'REDEEM-EMMA-25OFF',
      redemptionId: 'redeem-emma-1',
      shippingCost: 0, // Free shipping (Soulmate tier)
      tax: 12.80,
      total: 147.77, // 159.97 - 25 + 12.80
      trackingNumber: '9400111899223456789012',
      trackingCarrier: 'USPS',
      estimatedDelivery: new Date('2026-01-15'),
      shippingMethod: 'Express',
      addressId: 'addr-emma-ship',
      pointsEarned: 320, // 159.97 * 10 * 2 (2x for Soulmate) rounded
      pointsRedeemed: 2000,
      promotionApplied: null,
    },
    {
      // Alex's order - IN_TRANSIT, used WINTER20 promo + $10 redemption
      id: 'order-alex-1',
      orderNumber: generateOrderNumber(1002),
      customerId: 'cust-alex',
      email: 'alex.chen@email.com',
      status: 'IN_TRANSIT' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: hoodie?.id || products[0].id, variantId: hoodie?.variants[1]?.id || products[0].variants[1]?.id, quantity: 1, price: 89.99 },
        { productId: joggers?.id || products[6]?.id, variantId: joggers?.variants[0]?.id || products[6]?.variants[0]?.id, quantity: 1, price: 69.99 },
      ],
      subtotal: 159.98,
      discount: 42, // WINTER20 (20% of 159.98 = 32) + $10 redemption
      couponCode: 'WINTER20',
      redemptionId: 'redeem-alex-1',
      shippingCost: 0, // Free shipping (Bestie tier)
      tax: 9.44,
      total: 127.42, // 159.98 - 42 + 9.44
      trackingNumber: '9400111899223456789013',
      trackingCarrier: 'USPS',
      estimatedDelivery: new Date('2026-01-18'),
      shippingMethod: 'Standard',
      addressId: 'addr-alex-ship',
      pointsEarned: 240, // 159.98 * 10 * 1.5 (Bestie) rounded
      pointsRedeemed: 1000,
      promotionApplied: 'WINTER20 (20% off)',
    },
    {
      // Jordan's order - SHIPPED, used WELCOME15 promo
      id: 'order-jordan-1',
      orderNumber: generateOrderNumber(1003),
      customerId: 'cust-jordan',
      email: 'jordan.taylor@email.com',
      status: 'SHIPPED' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: tee?.id || products[3]?.id, variantId: tee?.variants[2]?.id || products[3]?.variants[2]?.id, quantity: 3, price: 34.99 },
      ],
      subtotal: 104.97,
      discount: 15.75, // WELCOME15 (15% of 104.97)
      couponCode: 'WELCOME15',
      shippingCost: 7.99, // Friend tier doesn't get free shipping under $75
      tax: 7.14,
      total: 104.35, // 104.97 - 15.75 + 7.99 + 7.14
      trackingNumber: '9400111899223456789014',
      trackingCarrier: 'USPS',
      estimatedDelivery: new Date('2026-01-20'),
      shippingMethod: 'Standard',
      addressId: 'addr-jordan-ship',
      pointsEarned: 131, // 104.97 * 10 * 1.25 (Friend) rounded
      pointsRedeemed: 0,
      promotionApplied: 'WELCOME15 (15% off)',
    },
    {
      // Sam's order - PROCESSING, no promo (first order)
      id: 'order-sam-1',
      orderNumber: generateOrderNumber(1004),
      customerId: 'cust-sam',
      email: 'sam.wilson@email.com',
      status: 'PROCESSING' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: tee?.id || products[3]?.id, variantId: tee?.variants[0]?.id || products[3]?.variants[0]?.id, quantity: 1, price: 34.99 },
      ],
      subtotal: 34.99,
      discount: 0,
      shippingCost: 5.99,
      tax: 2.80,
      total: 43.78, // 34.99 + 5.99 + 2.80
      trackingNumber: null, // Not shipped yet
      trackingCarrier: null,
      estimatedDelivery: new Date('2026-01-22'),
      shippingMethod: 'Standard',
      addressId: 'addr-sam-ship',
      pointsEarned: 35, // 34.99 * 10 * 1.0 (Newcomer) rounded
      pointsRedeemed: 0,
      promotionApplied: null,
    },
    {
      // Riley's order - OUT_FOR_DELIVERY, auto-applied free shipping promo
      id: 'order-riley-1',
      orderNumber: generateOrderNumber(1005),
      customerId: 'cust-riley',
      email: 'riley.morgan@email.com',
      status: 'OUT_FOR_DELIVERY' as const,
      paymentStatus: 'PAID' as const,
      items: [
        { productId: hoodie?.id || products[0].id, variantId: hoodie?.variants[2]?.id || products[0].variants[2]?.id, quantity: 1, price: 99.99 },
        { productId: tote?.id || products[8]?.id, variantId: tote?.variants[0]?.id || products[8]?.variants[0]?.id, quantity: 1, price: 39.99 },
      ],
      subtotal: 139.98,
      discount: 0,
      shippingCost: 0, // Free shipping (Bestie tier)
      tax: 11.20,
      total: 151.18, // 139.98 + 11.20
      trackingNumber: '9400111899223456789015',
      trackingCarrier: 'UPS',
      estimatedDelivery: new Date('2026-01-16'),
      shippingMethod: 'Express',
      addressId: 'addr-riley-ship',
      pointsEarned: 210, // 139.98 * 10 * 1.5 (Bestie) rounded
      pointsRedeemed: 0,
      promotionApplied: 'Free Shipping (Bestie Tier)',
    },
  ]

  for (const orderData of ordersData) {
    const { items, ...orderFields } = orderData
    
    // Create/update order
    await prisma.order.upsert({
      where: { id: orderData.id },
      update: {
        ...orderFields,
        trackingHistory: JSON.stringify(generateTrackingHistory(orderFields.status)),
      },
      create: {
        ...orderFields,
        trackingHistory: JSON.stringify(generateTrackingHistory(orderFields.status)),
      },
    })

    // Create order items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const product = products.find(p => p.id === item.productId) || products[0]
      const variant = product.variants.find(v => v.id === item.variantId) || product.variants[0]
      
      await prisma.orderItem.upsert({
        where: { id: `${orderData.id}-item-${i}` },
        update: {},
        create: {
          id: `${orderData.id}-item-${i}`,
          orderId: orderData.id,
          productId: product.id,
          variantId: variant?.id,
          productName: product.name,
          variantName: variant?.name || `${variant?.size || ''} ${variant?.color || ''}`.trim(),
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        },
      })
    }

    const cust = customers.find(c => c.id === orderData.customerId)
    console.log(`   ✅ ${orderData.orderNumber} - ${cust?.firstName} (${orderData.status})`)
    console.log(`      💰 $${orderData.total.toFixed(2)} | 🎁 -$${orderData.discount} | 🌟 +${orderData.pointsEarned} pts`)
    if (orderData.promotionApplied) {
      console.log(`      🏷️  Promo: ${orderData.promotionApplied}`)
    }
    if (orderData.pointsRedeemed > 0) {
      console.log(`      🎟️  Redeemed: ${orderData.pointsRedeemed} pts`)
    }
  }
  console.log('')

  // ============================================
  // 5. POINTS TRANSACTIONS
  // ============================================
  console.log('💎 Seeding Points Transactions...')
  
  const pointsTransactions = [
    // Emma's transactions
    {
      id: 'pts-emma-earn-1',
      customerId: 'cust-emma',
      orderId: 'order-emma-1',
      points: 320,
      type: 'PURCHASE' as const,
      description: 'Points earned from order HOF-2601-1001 (2x Soulmate bonus)',
    },
    {
      id: 'pts-emma-redeem-1',
      customerId: 'cust-emma',
      orderId: 'order-emma-1',
      points: -2000,
      type: 'REDEMPTION' as const,
      description: 'Redeemed $25 Off reward on order HOF-2601-1001',
    },
    {
      id: 'pts-emma-review-1',
      customerId: 'cust-emma',
      points: 75, // 50 base + 25 photo bonus
      type: 'REVIEW' as const,
      description: 'Points earned for writing a review with photo',
    },
    // Alex's transactions
    {
      id: 'pts-alex-earn-1',
      customerId: 'cust-alex',
      orderId: 'order-alex-1',
      points: 240,
      type: 'PURCHASE' as const,
      description: 'Points earned from order HOF-2601-1002 (1.5x Bestie bonus)',
    },
    {
      id: 'pts-alex-redeem-1',
      customerId: 'cust-alex',
      orderId: 'order-alex-1',
      points: -1000,
      type: 'REDEMPTION' as const,
      description: 'Redeemed $10 Off reward on order HOF-2601-1002',
    },
    // Jordan's transactions
    {
      id: 'pts-jordan-earn-1',
      customerId: 'cust-jordan',
      orderId: 'order-jordan-1',
      points: 131,
      type: 'PURCHASE' as const,
      description: 'Points earned from order HOF-2601-1003 (1.25x Friend bonus)',
    },
    {
      id: 'pts-jordan-signup',
      customerId: 'cust-jordan',
      points: 100,
      type: 'BONUS' as const,
      description: 'Welcome bonus for joining Care Points program',
    },
    // Sam's transactions
    {
      id: 'pts-sam-earn-1',
      customerId: 'cust-sam',
      orderId: 'order-sam-1',
      points: 35,
      type: 'PURCHASE' as const,
      description: 'Points earned from order HOF-2601-1004',
    },
    {
      id: 'pts-sam-signup',
      customerId: 'cust-sam',
      points: 100,
      type: 'BONUS' as const,
      description: 'Welcome bonus for joining Care Points program',
    },
    // Riley's transactions
    {
      id: 'pts-riley-earn-1',
      customerId: 'cust-riley',
      orderId: 'order-riley-1',
      points: 210,
      type: 'PURCHASE' as const,
      description: 'Points earned from order HOF-2601-1005 (1.5x Bestie bonus)',
    },
    {
      id: 'pts-riley-referral',
      customerId: 'cust-riley',
      points: 500,
      type: 'REFERRAL' as const,
      description: 'Referral bonus - referred a new customer',
    },
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

  // ============================================
  // 6. PRODUCT REVIEWS
  // ============================================
  console.log('⭐ Seeding Reviews...')
  
  const reviews = [
    {
      id: 'review-emma-1',
      productId: hoodie?.id || products[0].id,
      customerId: 'cust-emma',
      customerName: 'Emma J.',
      rating: 5,
      title: 'Absolutely love it!',
      content: 'This hoodie is so comfortable and the quality is amazing. The fit is perfect and I\'ve already gotten so many compliments. Worth every penny!',
      isVerifiedPurchase: true,
      isApproved: true,
      helpfulCount: 12,
      images: JSON.stringify(['https://example.com/review-emma-1.jpg']),
    },
    {
      id: 'review-alex-1',
      productId: joggers?.id || products[6]?.id,
      customerId: 'cust-alex',
      customerName: 'Alex C.',
      rating: 4,
      title: 'Great joggers, runs slightly large',
      content: 'Really comfortable and stylish. Only giving 4 stars because they run a bit large - I\'d recommend sizing down.',
      isVerifiedPurchase: true,
      isApproved: true,
      helpfulCount: 8,
    },
    {
      id: 'review-riley-1',
      productId: tote?.id || products[8]?.id,
      customerId: 'cust-riley',
      customerName: 'Riley M.',
      rating: 5,
      title: 'Perfect everyday bag',
      content: 'Love the size and quality of this tote. It fits everything I need and looks great with any outfit.',
      isVerifiedPurchase: true,
      isApproved: true,
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

  // ============================================
  // 7. WISHLIST ITEMS
  // ============================================
  console.log('❤️  Seeding Wishlists...')
  
  const wishlists = [
    { id: 'wish-emma-1', customerId: 'cust-emma', productId: products[9]?.id || products[0].id }, // Limited Drop Hoodie
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

  // ============================================
  // 8. EXPENSES (Sample)
  // ============================================
  console.log('📊 Seeding Sample Expenses...')
  
  const expenses = [
    {
      id: 'exp-inv-jan',
      categoryId: 'exp-cat-inventory',
      description: 'Hoodie inventory restock - January',
      amount: 2500,
      date: new Date('2026-01-05'),
      vendor: 'Premium Apparel Co',
      paymentMethod: 'Bank Transfer',
      isRecurring: false,
    },
    {
      id: 'exp-ship-jan',
      categoryId: 'exp-cat-shipping',
      description: 'USPS shipping costs - Week 1',
      amount: 450,
      date: new Date('2026-01-08'),
      vendor: 'USPS',
      paymentMethod: 'Credit Card',
      isRecurring: false,
    },
    {
      id: 'exp-ads-jan',
      categoryId: 'exp-cat-marketing',
      description: 'Instagram ads - January campaign',
      amount: 800,
      date: new Date('2026-01-01'),
      vendor: 'Meta Ads',
      paymentMethod: 'Credit Card',
      isRecurring: true,
    },
    {
      id: 'exp-soft-jan',
      categoryId: 'exp-cat-software',
      description: 'Monthly SaaS subscriptions',
      amount: 299,
      date: new Date('2026-01-01'),
      vendor: 'Various',
      paymentMethod: 'Credit Card',
      isRecurring: true,
      notes: 'Includes Vercel, Stripe, Cloudinary, etc.',
    },
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

  // ============================================
  // 9. DROP NOTIFICATION SIGNUPS
  // ============================================
  console.log('🔔 Seeding Drop Notification Signups...')
  
  // Find any limited drop
  const limitedDrop = await prisma.drop.findFirst({ where: { isLimitedEdition: true } })
  
  if (limitedDrop) {
    const notificationSignups = [
      { id: 'notify-emma', dropId: limitedDrop.id, email: 'emma.johnson@email.com', customerId: 'cust-emma' },
      { id: 'notify-alex', dropId: limitedDrop.id, email: 'alex.chen@email.com', customerId: 'cust-alex' },
      { id: 'notify-riley', dropId: limitedDrop.id, email: 'riley.morgan@email.com', customerId: 'cust-riley' },
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
    console.log('   ⚠️  No limited drop found - skipping notifications\n')
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('═'.repeat(50))
  console.log('✅ Part 2 Complete! Transactional data seeded:')
  console.log('   • 5 Customers with loyalty tiers and points')
  console.log('   • 5 Addresses')
  console.log('   • 3 Reward Redemptions')
  console.log('   • 5 Orders with real products and tracking')
  console.log('   • 11 Points Transactions')
  console.log('   • 3 Product Reviews')
  console.log('   • 4 Wishlist Items')
  console.log('   • 4 Expenses')
  console.log('   • Drop notification signups')
  console.log('═'.repeat(50))
  console.log('\n📋 Order Summary:')
  console.log('   Order HOF-2601-1001: Emma (Soulmate) - DELIVERED')
  console.log('      → Used $25 redemption, earned 320 pts (2x multiplier)')
  console.log('   Order HOF-2601-1002: Alex (Bestie) - IN_TRANSIT')
  console.log('      → WINTER20 promo + $10 redemption, earned 240 pts')
  console.log('   Order HOF-2601-1003: Jordan (Friend) - SHIPPED')
  console.log('      → WELCOME15 promo, earned 131 pts')
  console.log('   Order HOF-2601-1004: Sam (Newcomer) - PROCESSING')
  console.log('      → No promo, earned 35 pts')
  console.log('   Order HOF-2601-1005: Riley (Bestie) - OUT_FOR_DELIVERY')
  console.log('      → Free shipping (tier perk), earned 210 pts')
  console.log('')
  console.log('🎉 Database fully seeded! Visit http://localhost:3000/order/track/{orderNumber}')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
