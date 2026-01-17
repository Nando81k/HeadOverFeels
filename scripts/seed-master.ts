/**
 * Master Seed Script - Complete Database Seeding
 * 
 * This script seeds ALL tables with realistic, interconnected data:
 * - 1 Admin account
 * - 100 Customers with varied spending, tiers, and activity
 * - Products, Categories, Collections
 * - Orders with real tracking data
 * - Points transactions (earned and redeemed)
 * - Reward redemptions
 * - Abandoned carts
 * - Reviews, Wishlists
 * - Support tickets
 * - Financial data (expenses, invoices, budgets, tax records)
 * - And more...
 * 
 * Run with: npx tsx scripts/seed-master.ts
 */

import { PrismaClient, OrderStatus, PaymentStatus } from '@prisma/client'
import { faker } from '@faker-js/faker'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ========================================
// HELPER FUNCTIONS
// ========================================

function generateId(): string {
  return faker.string.uuid()
}

function generateOrderNumber(counter: number): string {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `HOF-${year}${month}-${counter.toString().padStart(4, '0')}`
}

function generateTrackingNumber(carrier: string): string {
  switch (carrier) {
    case 'USPS':
      return '9400' + faker.string.numeric(18)
    case 'UPS':
      return '1Z' + faker.string.alphanumeric(16).toUpperCase()
    case 'FEDEX':
      return faker.string.numeric(12)
    default:
      return faker.string.alphanumeric(20).toUpperCase()
  }
}

function generateTrackingHistory(status: OrderStatus, carrier: string) {
  const events: { status: string; location: string; timestamp: string; description: string }[] = []
  const baseDate = faker.date.recent({ days: 14 })
  
  const statuses = [
    { status: 'ORDER_PLACED', offset: 0, description: 'Order placed and payment confirmed' },
    { status: 'PROCESSING', offset: 1, description: 'Order being prepared for shipment' },
    { status: 'SHIPPED', offset: 2, description: `Package shipped via ${carrier}` },
    { status: 'IN_TRANSIT', offset: 3, description: 'Package in transit to destination' },
    { status: 'OUT_FOR_DELIVERY', offset: 5, description: 'Out for delivery' },
    { status: 'DELIVERED', offset: 6, description: 'Package delivered successfully' },
  ]

  const statusIndex: Record<string, number> = {
    'PENDING': 0, 'CONFIRMED': 0, 'PROCESSING': 2, 'SHIPPED': 3,
    'IN_TRANSIT': 4, 'OUT_FOR_DELIVERY': 5, 'DELIVERED': 6,
    'CANCELLED': 0, 'REFUNDED': 0,
  }

  const endIndex = statusIndex[status] || 0
  const cities = ['Los Angeles, CA', 'Phoenix, AZ', 'Dallas, TX', 'Memphis, TN', 'Louisville, KY', 'Local Facility']

  for (let i = 0; i <= endIndex && i < statuses.length; i++) {
    const eventDate = new Date(baseDate)
    eventDate.setDate(eventDate.getDate() + statuses[i].offset)
    
    events.push({
      status: statuses[i].status,
      location: cities[i] || faker.location.city() + ', ' + faker.location.state({ abbreviated: true }),
      timestamp: eventDate.toISOString(),
      description: statuses[i].description,
    })
  }

  return events
}

// ========================================
// PRODUCT DATA
// ========================================

const PRODUCT_IMAGES = {
  hoodies: [
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80',
    'https://images.unsplash.com/photo-1578681994506-b8f463449011?w=800&q=80',
    'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80',
    'https://images.unsplash.com/photo-1542406775-ade58c52d2e4?w=800&q=80',
    'https://images.unsplash.com/photo-1614495039153-e9cd13240469?w=800&q=80',
  ],
  tshirts: [
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
    'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80',
    'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&q=80',
    'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80',
    'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80',
  ],
  joggers: [
    'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&q=80',
    'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80',
    'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80',
    'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&q=80',
  ],
  accessories: [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80',
    'https://images.unsplash.com/photo-1622560480654-d96214fdc887?w=800&q=80',
    'https://images.unsplash.com/photo-1575032617751-6ddec2089882?w=800&q=80',
  ],
}

const COLORS = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Navy', hex: '#1e3a5f' },
  { name: 'Heather Grey', hex: '#9ca3af' },
  { name: 'Forest Green', hex: '#228b22' },
  { name: 'Burgundy', hex: '#722f37' },
  { name: 'Cream', hex: '#fffdd0' },
  { name: 'Dusty Rose', hex: '#dcae96' },
]

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const CARRIERS = ['USPS', 'UPS', 'FEDEX']

// ========================================
// MAIN SEED FUNCTION
// ========================================

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🌱 HEAD OVER FEELS - MASTER SEED SCRIPT')
  console.log('═'.repeat(70))
  
  const defaultPassword = await bcrypt.hash('password123', 10)
  const adminPassword = await bcrypt.hash('Nando1220@', 12)
  
  // ============================================
  // 1. SEED ADMIN USER
  // ============================================
  console.log('\n👤 Seeding Admin User...')
  
  const adminUser = await prisma.admin_users.upsert({
    where: { email: 'kommandernando@outlook.com' },
    update: { password: adminPassword, updatedAt: new Date() },
    create: {
      id: generateId(),
      email: 'kommandernando@outlook.com',
      name: 'Nando (Admin)',
      password: adminPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
      updatedAt: new Date(),
    },
  })
  console.log(`   ✅ Admin: ${adminUser.email}`)

  // ============================================
  // 2. SEED CATEGORIES
  // ============================================
  console.log('\n📁 Seeding Categories...')
  const categoryData = [
    { name: 'Hoodies', slug: 'hoodies', description: 'Cozy hoodies for every mood' },
    { name: 'T-Shirts', slug: 'tshirts', description: 'Essential tees for everyday wear' },
    { name: 'Bottoms', slug: 'bottoms', description: 'Joggers, pants, and more' },
    { name: 'Accessories', slug: 'accessories', description: 'Complete your look' },
  ]
  
  const categories: Record<string, string> = {}
  for (let i = 0; i < categoryData.length; i++) {
    const cat = categoryData[i]
    const created = await prisma.categories.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { id: generateId(), ...cat, sortOrder: i, isActive: true },
    })
    categories[cat.slug] = created.id
    console.log(`   ✅ ${cat.name}`)
  }

  // ============================================
  // 3. SEED COLLECTIONS
  // ============================================
  console.log('\n🗂️  Seeding Collections...')
  const collectionData = [
    { name: 'New Arrivals', slug: 'new-arrivals', description: 'Fresh drops you\'ll love', isFeatured: true },
    { name: 'Best Sellers', slug: 'best-sellers', description: 'Fan favorites', isFeatured: true },
    { name: 'Sale', slug: 'sale', description: 'Great deals on great fits' },
    { name: 'Limited Edition', slug: 'limited-edition', description: 'Exclusive drops, limited quantities' },
  ]
  
  const collections: Record<string, string> = {}
  for (let i = 0; i < collectionData.length; i++) {
    const coll = collectionData[i]
    const created = await prisma.collections.upsert({
      where: { slug: coll.slug },
      update: {},
      create: { id: generateId(), ...coll, sortOrder: i, isActive: true },
    })
    collections[coll.slug] = created.id
    console.log(`   ✅ ${coll.name}`)
  }

  // ============================================
  // 4. SEED PRODUCTS
  // ============================================
  console.log('\n📦 Seeding Products...')
  
  const productDefinitions = [
    { name: 'Comfort Cloud Hoodie', slug: 'comfort-cloud-hoodie', category: 'hoodies', price: 89.99, costPrice: 35, compareAt: 110, images: PRODUCT_IMAGES.hoodies.slice(0, 3), featured: true },
    { name: 'Urban Edge Hoodie', slug: 'urban-edge-hoodie', category: 'hoodies', price: 79.99, costPrice: 30, compareAt: null, images: PRODUCT_IMAGES.hoodies.slice(1, 4), featured: true },
    { name: 'Vintage Wash Hoodie', slug: 'vintage-wash-hoodie', category: 'hoodies', price: 94.99, costPrice: 38, compareAt: 120, images: PRODUCT_IMAGES.hoodies.slice(2, 5), featured: false },
    { name: 'Oversized Fleece Hoodie', slug: 'oversized-fleece-hoodie', category: 'hoodies', price: 99.99, costPrice: 40, compareAt: null, images: [PRODUCT_IMAGES.hoodies[3], PRODUCT_IMAGES.hoodies[4]], featured: true },
    { name: 'Limited Drop Hoodie', slug: 'limited-drop-hoodie', category: 'hoodies', price: 129.99, costPrice: 50, compareAt: null, images: PRODUCT_IMAGES.hoodies, isLimited: true, maxQty: 50 },
    { name: 'Essential Crew Tee', slug: 'essential-crew-tee', category: 'tshirts', price: 34.99, costPrice: 12, compareAt: null, images: PRODUCT_IMAGES.tshirts.slice(0, 2), featured: true },
    { name: 'Premium Cotton Tee', slug: 'premium-cotton-tee', category: 'tshirts', price: 39.99, costPrice: 14, compareAt: 50, images: PRODUCT_IMAGES.tshirts.slice(1, 3), featured: true },
    { name: 'Graphic Print Tee', slug: 'graphic-print-tee', category: 'tshirts', price: 44.99, costPrice: 16, compareAt: null, images: PRODUCT_IMAGES.tshirts.slice(2, 4), featured: false },
    { name: 'Relaxed Fit Tee', slug: 'relaxed-fit-tee', category: 'tshirts', price: 36.99, costPrice: 13, compareAt: null, images: PRODUCT_IMAGES.tshirts.slice(3, 5), featured: false },
    { name: 'Limited Edition Tee', slug: 'limited-edition-tee', category: 'tshirts', price: 59.99, costPrice: 22, compareAt: null, images: PRODUCT_IMAGES.tshirts, isLimited: true, maxQty: 100 },
    { name: 'Classic Joggers', slug: 'classic-joggers', category: 'bottoms', price: 69.99, costPrice: 25, compareAt: 85, images: PRODUCT_IMAGES.joggers.slice(0, 2), featured: true },
    { name: 'Tech Fleece Joggers', slug: 'tech-fleece-joggers', category: 'bottoms', price: 79.99, costPrice: 30, compareAt: null, images: PRODUCT_IMAGES.joggers.slice(1, 3), featured: true },
    { name: 'Slim Fit Joggers', slug: 'slim-fit-joggers', category: 'bottoms', price: 74.99, costPrice: 28, compareAt: null, images: PRODUCT_IMAGES.joggers.slice(2, 4), featured: false },
    { name: 'Canvas Tote Bag', slug: 'canvas-tote-bag', category: 'accessories', price: 29.99, costPrice: 8, compareAt: null, images: PRODUCT_IMAGES.accessories.slice(0, 2), featured: true },
    { name: 'Embroidered Cap', slug: 'embroidered-cap', category: 'accessories', price: 24.99, costPrice: 7, compareAt: 35, images: PRODUCT_IMAGES.accessories.slice(1, 3), featured: false },
    { name: 'Beanie', slug: 'cozy-knit-beanie', category: 'accessories', price: 22.99, costPrice: 6, compareAt: null, images: PRODUCT_IMAGES.accessories.slice(2, 4), featured: false },
    { name: 'Socks 3-Pack', slug: 'comfort-socks-3pack', category: 'accessories', price: 19.99, costPrice: 5, compareAt: null, images: [PRODUCT_IMAGES.accessories[3]], featured: false },
  ]
  
  const products: { id: string; name: string; price: number; costPrice: number; variants: { id: string; size?: string; color?: string }[] }[] = []
  
  for (const prod of productDefinitions) {
    const categoryId = categories[prod.category]
    const releaseDate = prod.isLimited ? faker.date.recent({ days: 7 }) : null
    const dropEndDate = prod.isLimited ? faker.date.soon({ days: 14 }) : null
    
    const product = await prisma.products.upsert({
      where: { slug: prod.slug },
      update: { images: JSON.stringify(prod.images), price: prod.price, compareAtPrice: prod.compareAt, isFeatured: prod.featured },
      create: {
        id: generateId(),
        name: prod.name,
        slug: prod.slug,
        description: faker.commerce.productDescription(),
        price: prod.price,
        costPrice: prod.costPrice,
        compareAtPrice: prod.compareAt,
        categoryId,
        images: JSON.stringify(prod.images),
        materials: 'Premium cotton blend, sustainably sourced',
        careGuide: 'Machine wash cold. Tumble dry low. Do not bleach.',
        isLimitedEdition: prod.isLimited || false,
        releaseDate,
        dropEndDate,
        maxQuantity: prod.maxQty || null,
        isActive: true,
        isFeatured: prod.featured || false,
        isFeaturedNewArrival: faker.datatype.boolean({ probability: 0.3 }),
      },
    })
    
    const variants: { id: string; size?: string; color?: string }[] = []
    const colorsToUse = faker.helpers.arrayElements(COLORS, { min: 2, max: 4 })
    const sizesToUse = prod.category === 'accessories' ? ['One Size'] : SIZES
    
    for (const color of colorsToUse) {
      for (const size of sizesToUse) {
        const sku = `${prod.slug}-${color.name.toLowerCase().replace(/\s/g, '-')}-${size.toLowerCase()}`
        const variant = await prisma.product_variants.upsert({
          where: { sku },
          update: { inventory: faker.number.int({ min: 5, max: 100 }) },
          create: {
            id: generateId(),
            productId: product.id,
            sku,
            size,
            color: color.name,
            colorHex: color.hex,
            inventory: faker.number.int({ min: 5, max: 100 }),
            costPrice: prod.costPrice,
            isActive: true,
          },
        })
        variants.push({ id: variant.id, size, color: color.name })
      }
    }
    
    products.push({ id: product.id, name: product.name, price: product.price, costPrice: prod.costPrice, variants })
    console.log(`   ✅ ${product.name} (${variants.length} variants)`)
  }

  // Link products to collections
  const newArrivals = products.slice(-5)
  const bestSellers = products.slice(0, 5)
  const saleItems = products.filter(p => productDefinitions.find(pd => pd.name === p.name)?.compareAt)
  const limitedItems = products.filter(p => productDefinitions.find(pd => pd.name === p.name)?.isLimited)
  
  for (const prod of newArrivals) {
    await prisma.collection_products.upsert({
      where: { collectionId_productId: { collectionId: collections['new-arrivals'], productId: prod.id } },
      update: {}, create: { id: generateId(), collectionId: collections['new-arrivals'], productId: prod.id },
    })
  }
  for (const prod of bestSellers) {
    await prisma.collection_products.upsert({
      where: { collectionId_productId: { collectionId: collections['best-sellers'], productId: prod.id } },
      update: {}, create: { id: generateId(), collectionId: collections['best-sellers'], productId: prod.id },
    })
  }
  for (const prod of saleItems) {
    await prisma.collection_products.upsert({
      where: { collectionId_productId: { collectionId: collections['sale'], productId: prod.id } },
      update: {}, create: { id: generateId(), collectionId: collections['sale'], productId: prod.id },
    })
  }
  for (const prod of limitedItems) {
    await prisma.collection_products.upsert({
      where: { collectionId_productId: { collectionId: collections['limited-edition'], productId: prod.id } },
      update: {}, create: { id: generateId(), collectionId: collections['limited-edition'], productId: prod.id },
    })
  }
  console.log(`   📦 Linked products to 4 collections`)

  // ============================================
  // 5. SEED LOYALTY TIERS
  // ============================================
  console.log('\n🏆 Seeding Loyalty Tiers...')
  const tiers = [
    { id: 'tier-newcomer', name: 'Newcomer', slug: 'newcomer', minAnnualSpend: 0, minAnnualPoints: 0, pointMultiplier: 1.0, freeShipping: false, earlyDropAccess: false, sortOrder: 0, perks: JSON.stringify(['Earn 10 Care Points per $1 spent', 'Birthday surprise', 'Early sale access']) },
    { id: 'tier-friend', name: 'Friend', slug: 'friend', minAnnualSpend: 100, minAnnualPoints: 1000, pointMultiplier: 1.25, freeShipping: false, earlyDropAccess: false, sortOrder: 1, perks: JSON.stringify(['Earn 12.5 Care Points per $1 spent (1.25x)', 'Birthday bonus points', 'Early access to sales', 'Free shipping on orders $75+']) },
    { id: 'tier-bestie', name: 'Bestie', slug: 'bestie', minAnnualSpend: 300, minAnnualPoints: 3000, pointMultiplier: 1.5, freeShipping: true, earlyDropAccess: false, sortOrder: 2, perks: JSON.stringify(['Earn 15 Care Points per $1 spent (1.5x)', 'FREE shipping on all orders', '24-hour early access to sales', 'Exclusive Bestie-only products']) },
    { id: 'tier-soulmate', name: 'Soulmate', slug: 'soulmate', minAnnualSpend: 750, minAnnualPoints: 7500, pointMultiplier: 2.0, freeShipping: true, earlyDropAccess: true, sortOrder: 3, perks: JSON.stringify(['Earn 20 Care Points per $1 spent (2x)', 'FREE express shipping', '48-hour early access to limited drops', 'Annual surprise gift', 'Priority support']) },
  ]
  
  for (const tier of tiers) {
    await prisma.loyalty_tiers.upsert({
      where: { id: tier.id },
      update: tier,
      create: { ...tier, isActive: true },
    })
    console.log(`   ✅ ${tier.name} (${tier.minAnnualSpend}+ annual spend)`)
  }

  // ============================================
  // 6. SEED REWARDS
  // ============================================
  console.log('\n🎁 Seeding Loyalty Rewards...')
  const rewards = [
    { id: 'reward-5off', name: '$5 Off Your Order', slug: 'five-dollars-off', description: 'Get $5 off your next purchase', pointsCost: 500, rewardType: 'DISCOUNT' as const, value: 5, isActive: true, sortOrder: 0 },
    { id: 'reward-10off', name: '$10 Off Your Order', slug: 'ten-dollars-off', description: 'Get $10 off your next purchase', pointsCost: 1000, rewardType: 'DISCOUNT' as const, value: 10, isActive: true, sortOrder: 1 },
    { id: 'reward-25off', name: '$25 Off Your Order', slug: 'twentyfive-dollars-off', description: 'Get $25 off your next purchase', pointsCost: 2000, rewardType: 'DISCOUNT' as const, value: 25, isActive: true, sortOrder: 2 },
    { id: 'reward-freeship', name: 'Free Shipping', slug: 'free-shipping', description: 'Free standard shipping on your next order', pointsCost: 300, rewardType: 'FREE_SHIPPING' as const, value: null, isActive: true, sortOrder: 3 },
    { id: 'reward-15percent', name: '15% Off Entire Order', slug: 'fifteen-percent-off', description: '15% off your entire order (max $50 discount)', pointsCost: 1500, rewardType: 'DISCOUNT' as const, value: 15, isActive: true, sortOrder: 4 },
    { id: 'reward-earlyaccess', name: 'Early Drop Access Pass', slug: 'early-drop-access', description: 'Get 24-hour early access to the next limited drop', pointsCost: 750, rewardType: 'EARLY_ACCESS' as const, value: null, isActive: true, sortOrder: 5 },
    { id: 'reward-50off', name: '$50 Off Your Order', slug: 'fifty-dollars-off', description: 'Get $50 off your next purchase', pointsCost: 3500, rewardType: 'DISCOUNT' as const, value: 50, isActive: true, sortOrder: 6 },
    { id: 'reward-mystery', name: 'Mystery Gift Box', slug: 'mystery-gift-box', description: 'Receive a surprise gift box with exclusive items', pointsCost: 5000, rewardType: 'PHYSICAL_PERK' as const, value: null, isActive: true, minTierRequired: 'tier-bestie', sortOrder: 7 },
  ]
  
  for (const reward of rewards) {
    await prisma.rewards.upsert({
      where: { slug: reward.slug },
      update: reward,
      create: reward,
    })
    console.log(`   ✅ ${reward.name} (${reward.pointsCost} pts)`)
  }

  // ============================================
  // 7. SEED 100 CUSTOMERS
  // ============================================
  console.log('\n👥 Seeding 100 Customers...')
  
  // Distribution: 40 Newcomer, 30 Friend, 20 Bestie, 10 Soulmate
  const tierDistribution = [
    { tierId: 'tier-newcomer', count: 40, minSpend: 0, maxSpend: 99 },
    { tierId: 'tier-friend', count: 30, minSpend: 100, maxSpend: 299 },
    { tierId: 'tier-bestie', count: 20, minSpend: 300, maxSpend: 749 },
    { tierId: 'tier-soulmate', count: 10, minSpend: 750, maxSpend: 2000 },
  ]
  
  interface CustomerData {
    id: string
    email: string
    name: string
    tierId: string
    totalSpent: number
    totalOrders: number
    currentPoints: number
    lifetimePoints: number
    addressId?: string
  }
  
  const customers: CustomerData[] = []
  
  // First, add the admin as a customer too (but not counted in the 100)
  const adminCustomer = await prisma.customers.upsert({
    where: { email: 'kommandernando@outlook.com' },
    update: { isAdmin: true, password: adminPassword },
    create: {
      id: generateId(),
      email: 'kommandernando@outlook.com',
      password: adminPassword,
      name: 'Nando',
      isAdmin: true,
      emailVerified: new Date(),
      loyaltyTierId: 'tier-soulmate',
      currentPoints: 15000,
      lifetimePoints: 25000,
      totalSpent: 2500,
      totalOrders: 25,
      annualSpend: 2500,
      annualPointsEarned: 25000,
    },
  })
  console.log(`   ✅ Admin customer: ${adminCustomer.email}`)

  for (const tierDist of tierDistribution) {
    const tier = tiers.find(t => t.id === tierDist.tierId)!
    
    for (let i = 0; i < tierDist.count; i++) {
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()
      const email = faker.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase()
      const totalSpent = faker.number.float({ min: tierDist.minSpend, max: tierDist.maxSpend, fractionDigits: 2 })
      const totalOrders = Math.max(1, Math.floor(totalSpent / 50))
      const lifetimePoints = Math.floor(totalSpent * tier.pointMultiplier * 10)
      // Some customers have redeemed points, some haven't
      const redemptionRate = faker.number.float({ min: 0.1, max: 0.7 })
      const currentPoints = Math.floor(lifetimePoints * (1 - redemptionRate))
      
      const customer = await prisma.customers.upsert({
        where: { email },
        update: {},
        create: {
          id: generateId(),
          email,
          password: defaultPassword,
          name: `${firstName} ${lastName}`,
          phone: faker.phone.number({ style: 'national' }),
          birthday: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }),
          newsletter: faker.datatype.boolean({ probability: 0.7 }),
          smsOptIn: faker.datatype.boolean({ probability: 0.4 }),
          totalSpent,
          totalOrders,
          avgOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
          annualSpend: totalSpent,
          loyaltyTierId: tierDist.tierId,
          currentPoints,
          lifetimePoints,
          annualPointsEarned: lifetimePoints,
          emailVerified: faker.datatype.boolean({ probability: 0.8 }) ? faker.date.recent({ days: 90 }) : null,
        },
      })
      
      // Create address
      const address = await prisma.addresses.create({
        data: {
          id: generateId(),
          customerId: customer.id,
          firstName,
          lastName,
          address1: faker.location.streetAddress(),
          address2: faker.datatype.boolean({ probability: 0.3 }) ? faker.location.secondaryAddress() : null,
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          postalCode: faker.location.zipCode(),
          country: 'US',
          isDefault: true,
        },
      })
      
      customers.push({
        id: customer.id,
        email: customer.email,
        name: customer.name || '',
        tierId: tierDist.tierId,
        totalSpent,
        totalOrders,
        currentPoints,
        lifetimePoints,
        addressId: address.id,
      })
    }
    
    console.log(`   ✅ ${tierDist.count} ${tier.name} customers`)
  }
  console.log(`   📊 Total: ${customers.length} customers`)

  // ============================================
  // 8. SEED ORDERS
  // ============================================
  console.log('\n📦 Seeding Orders...')
  
  let orderCounter = 1000
  const orderStatuses: OrderStatus[] = ['DELIVERED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PROCESSING', 'PENDING']
  const statusWeights = [40, 20, 15, 10, 10, 5]
  
  const allOrders: { id: string; customerId: string; orderNumber: string; total: number; status: OrderStatus }[] = []
  
  for (const customer of customers) {
    const numOrders = Math.min(customer.totalOrders, faker.number.int({ min: 1, max: 5 }))
    
    for (let o = 0; o < numOrders; o++) {
      orderCounter++
      const orderNumber = generateOrderNumber(orderCounter)
      
      const statusRoll = faker.number.int({ min: 1, max: 100 })
      let cumulative = 0
      let status: OrderStatus = 'DELIVERED'
      for (let s = 0; s < orderStatuses.length; s++) {
        cumulative += statusWeights[s]
        if (statusRoll <= cumulative) { status = orderStatuses[s]; break }
      }
      
      const carrier = faker.helpers.arrayElement(CARRIERS)
      const hasTracking = ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)
      const trackingNumber = hasTracking ? generateTrackingNumber(carrier) : null
      const trackingHistory = hasTracking ? generateTrackingHistory(status, carrier) : null
      
      const numItems = faker.number.int({ min: 1, max: 3 })
      const orderProducts = faker.helpers.arrayElements(products, numItems)
      
      let subtotal = 0
      const items: { productId: string; variantId: string; quantity: number; price: number; name: string; image?: string }[] = []
      
      for (const prod of orderProducts) {
        const variant = faker.helpers.arrayElement(prod.variants)
        const quantity = faker.number.int({ min: 1, max: 2 })
        subtotal += prod.price * quantity
        const productData = productDefinitions.find(pd => pd.name === prod.name)
        items.push({
          productId: prod.id,
          variantId: variant.id,
          quantity,
          price: prod.price,
          name: prod.name,
          image: productData?.images?.[0],
        })
      }
      
      const shipping = subtotal >= 75 ? 0 : 7.99
      const tax = subtotal * 0.08
      const discount = faker.datatype.boolean({ probability: 0.2 }) ? subtotal * 0.15 : 0
      const total = subtotal + shipping + tax - discount
      
      const paymentStatus: PaymentStatus = ['DELIVERED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PROCESSING'].includes(status) ? 'PAID' : 'PENDING'
      
      const createdAt = faker.date.recent({ days: 60 })
      const estimatedDelivery = new Date(createdAt)
      estimatedDelivery.setDate(estimatedDelivery.getDate() + faker.number.int({ min: 3, max: 7 }))
      
      try {
        const order = await prisma.orders.create({
          data: {
            id: generateId(),
            orderNumber,
            customerId: customer.id,
            customerEmail: customer.email,
            status,
            paymentStatus,
            subtotal,
            shipping,
            tax,
            discount,
            total,
            shippingAddressId: customer.addressId!,
            billingAddressId: customer.addressId!,
            shippingMethod: shipping === 0 ? 'Free Shipping' : 'Standard',
            trackingNumber,
            carrier: hasTracking ? carrier : null,
            estimatedDelivery,
            deliveredAt: status === 'DELIVERED' ? faker.date.recent({ days: 7 }) : null,
            shippedAt: hasTracking ? faker.date.recent({ days: 10 }) : null,
            notes: trackingHistory ? JSON.stringify(trackingHistory) : null,
            createdAt,
          },
        })
        
        for (const item of items) {
          await prisma.order_items.create({
            data: {
              id: generateId(),
              orderId: order.id,
              productId: item.productId,
              productVariantId: item.variantId,
              quantity: item.quantity,
              price: item.price,
              productName: item.name,
              productImage: item.image || null,
            },
          })
        }
        
        allOrders.push({ id: order.id, customerId: customer.id, orderNumber, total, status })
      } catch (e) {
        // Skip duplicate order numbers
      }
    }
  }
  
  console.log(`   ✅ Created ${allOrders.length} orders`)

  // ============================================
  // 9. SEED POINTS TRANSACTIONS
  // ============================================
  console.log('\n💎 Seeding Points Transactions...')
  
  let ptxCount = 0
  
  // Points earned from orders
  for (const order of allOrders.filter(o => o.status !== 'PENDING' && o.status !== 'CANCELLED')) {
    const customer = customers.find(c => c.id === order.customerId)
    if (customer) {
      const tier = tiers.find(t => t.id === customer.tierId)
      const pointsEarned = Math.floor(order.total * (tier?.pointMultiplier || 1) * 10)
      
      await prisma.points_transactions.create({
        data: {
          id: generateId(),
          customerId: customer.id,
          orderId: order.id,
          points: pointsEarned,
          type: 'PURCHASE',
          description: `Points earned from order ${order.orderNumber}`,
          createdAt: faker.date.recent({ days: 30 }),
        },
      })
      ptxCount++
    }
  }
  
  // Signup bonuses
  for (const customer of customers.slice(0, 50)) {
    await prisma.points_transactions.create({
      data: {
        id: generateId(),
        customerId: customer.id,
        points: 100,
        type: 'ACCOUNT_CREATION',
        description: 'Welcome bonus for joining Care Points program',
        createdAt: faker.date.past({ years: 1 }),
      },
    })
    ptxCount++
  }
  
  console.log(`   ✅ Created ${ptxCount} points transactions`)

  // ============================================
  // 10. SEED REWARD REDEMPTIONS
  // ============================================
  console.log('\n🎟️  Seeding Reward Redemptions...')
  
  let redemptionCount = 0
  const customersWithPoints = customers.filter(c => c.lifetimePoints > 500)
  const redemptionCustomers = faker.helpers.arrayElements(customersWithPoints, Math.min(40, customersWithPoints.length))
  
  for (const customer of redemptionCustomers) {
    // Pick a reward they can afford
    const affordableRewards = rewards.filter(r => r.pointsCost <= customer.lifetimePoints * 0.5)
    if (affordableRewards.length === 0) continue
    
    const reward = faker.helpers.arrayElement(affordableRewards)
    const customerOrders = allOrders.filter(o => o.customerId === customer.id)
    const usedOrder = customerOrders.length > 0 && faker.datatype.boolean({ probability: 0.6 }) 
      ? faker.helpers.arrayElement(customerOrders) 
      : null
    
    const redemption = await prisma.reward_redemptions.create({
      data: {
        id: generateId(),
        customerId: customer.id,
        rewardId: reward.id,
        pointsSpent: reward.pointsCost,
        status: usedOrder ? 'USED' : faker.helpers.arrayElement(['PENDING', 'ACTIVE']),
        couponCode: `REWARD-${faker.string.alphanumeric(8).toUpperCase()}`,
        usedAt: usedOrder ? faker.date.recent({ days: 14 }) : null,
        orderId: usedOrder?.id || null,
        idempotencyKey: generateId(),
        createdAt: faker.date.recent({ days: 30 }),
      },
    })
    
    // Create points deduction transaction
    await prisma.points_transactions.create({
      data: {
        id: generateId(),
        customerId: customer.id,
        redemptionId: redemption.id,
        points: -reward.pointsCost,
        type: 'REDEMPTION',
        description: `Redeemed: ${reward.name}`,
        createdAt: faker.date.recent({ days: 30 }),
      },
    })
    
    redemptionCount++
  }
  
  console.log(`   ✅ Created ${redemptionCount} reward redemptions`)

  // ============================================
  // 11. SEED ABANDONED CARTS
  // ============================================
  console.log('\n🛒 Seeding Abandoned Carts...')
  
  const customersForAbandoned = faker.helpers.arrayElements(customers, 20)
  
  for (const customer of customersForAbandoned) {
    const cartProducts = faker.helpers.arrayElements(products, { min: 1, max: 3 })
    const items = cartProducts.map(p => ({
      productId: p.id,
      productName: p.name,
      price: p.price,
      quantity: faker.number.int({ min: 1, max: 2 }),
      variantId: faker.helpers.arrayElement(p.variants).id,
    }))
    
    const totalValue = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const abandonedAt = faker.date.recent({ days: 7 })
    const expiresAt = new Date(abandonedAt)
    expiresAt.setDate(expiresAt.getDate() + 7)
    
    await prisma.abandoned_carts.create({
      data: {
        id: generateId(),
        customerId: customer.id,
        customerEmail: customer.email,
        customerName: customer.name,
        items: JSON.stringify(items),
        totalValue,
        itemCount: items.length,
        abandonedAt,
        expiresAt,
        recoveryEmailSent: faker.datatype.boolean({ probability: 0.3 }),
        recoveryEmailSentAt: faker.datatype.boolean({ probability: 0.3 }) ? faker.date.recent({ days: 5 }) : null,
        discountCode: faker.datatype.boolean({ probability: 0.2 }) ? 'COMEBACK10' : null,
        discountAmount: faker.datatype.boolean({ probability: 0.2 }) ? 10 : null,
      },
    })
  }
  
  console.log(`   ✅ Created ${customersForAbandoned.length} abandoned carts`)

  // ============================================
  // 12. SEED REVIEWS
  // ============================================
  console.log('\n⭐ Seeding Reviews...')
  
  const reviewCount = 50
  const reviewCustomers = faker.helpers.arrayElements(customers.filter(c => c.totalOrders > 0), reviewCount)
  
  for (const customer of reviewCustomers) {
    const product = faker.helpers.arrayElement(products)
    const rating = faker.helpers.weightedArrayElement([
      { weight: 50, value: 5 }, { weight: 30, value: 4 }, { weight: 15, value: 3 }, { weight: 4, value: 2 }, { weight: 1, value: 1 },
    ])
    
    try {
      const review = await prisma.reviews.create({
        data: {
          id: generateId(),
          productId: product.id,
          customerId: customer.id,
          customerName: customer.name.split(' ')[0] + ' ' + (customer.name.split(' ')[1]?.[0] || '') + '.',
          customerEmail: customer.email,
          rating,
          title: faker.helpers.arrayElement(['Love it!', 'Great quality', 'Perfect fit', 'Highly recommend', 'Good value', 'Nice material', 'Amazing!', 'Worth the price']),
          comment: faker.lorem.sentences({ min: 1, max: 3 }),
          isVerified: faker.datatype.boolean({ probability: 0.8 }),
          status: faker.helpers.weightedArrayElement([{ weight: 80, value: 'APPROVED' as const }, { weight: 15, value: 'PENDING' as const }, { weight: 5, value: 'REJECTED' as const }]),
          helpfulCount: faker.number.int({ min: 0, max: 25 }),
        },
      })
      
      // Give points for verified reviews
      if (review.isVerified && review.status === 'APPROVED') {
        await prisma.points_transactions.create({
          data: {
            id: generateId(),
            customerId: customer.id,
            reviewId: review.id,
            points: 25,
            type: 'REVIEW',
            description: `Points earned for reviewing ${product.name}`,
          },
        })
      }
    } catch {
      // Skip duplicates
    }
  }
  
  console.log(`   ✅ Created ${reviewCount} reviews`)

  // ============================================
  // 13. SEED WISHLISTS
  // ============================================
  console.log('\n❤️  Seeding Wishlists...')
  
  const wishlistCustomers = faker.helpers.arrayElements(customers, 50)
  let wishlistCount = 0
  
  for (const customer of wishlistCustomers) {
    const wishProducts = faker.helpers.arrayElements(products, { min: 1, max: 5 })
    for (const product of wishProducts) {
      try {
        await prisma.wishlist_items.create({
          data: {
            id: generateId(),
            customerId: customer.id,
            productId: product.id,
            productVariantId: faker.helpers.arrayElement(product.variants).id,
            priority: faker.number.int({ min: 0, max: 3 }),
          },
        })
        wishlistCount++
      } catch {
        // Skip duplicates
      }
    }
  }
  
  console.log(`   ✅ Created ${wishlistCount} wishlist items`)

  // ============================================
  // 14. SEED SUPPORT TICKETS
  // ============================================
  console.log('\n🎫 Seeding Support Tickets...')
  
  const ticketCustomers = faker.helpers.arrayElements(customers, 15)
  const ticketTypes = ['ORDER_ISSUE', 'RETURN', 'PRODUCT_QUESTION', 'SHIPPING_ISSUE', 'GENERAL'] as const
  const ticketStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
  
  for (const customer of ticketCustomers) {
    const type = faker.helpers.arrayElement(ticketTypes)
    const status = faker.helpers.arrayElement(ticketStatuses)
    const customerOrder = allOrders.find(o => o.customerId === customer.id)
    
    const ticket = await prisma.support_tickets.create({
      data: {
        id: generateId(),
        ticketNumber: `TKT-${faker.string.numeric(6)}`,
        type,
        status,
        priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH']) as 'LOW' | 'MEDIUM' | 'HIGH',
        subject: faker.helpers.arrayElement([
          'Where is my order?', 'Need to change shipping address', 'Item arrived damaged',
          'Wrong size received', 'How do I return?', 'Discount code not working', 'Question about product'
        ]),
        customerId: customer.id,
        customerEmail: customer.email,
        customerName: customer.name,
        orderId: customerOrder?.id || null,
        orderNumber: customerOrder?.orderNumber || null,
        assignedToId: faker.datatype.boolean({ probability: 0.5 }) ? adminUser.id : null,
        resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? faker.date.recent({ days: 7 }) : null,
        createdAt: faker.date.recent({ days: 30 }),
      },
    })
    
    // Add some messages
    const messageCount = faker.number.int({ min: 1, max: 4 })
    for (let m = 0; m < messageCount; m++) {
      await prisma.support_messages.create({
        data: {
          id: generateId(),
          ticketId: ticket.id,
          message: faker.lorem.sentences({ min: 1, max: 3 }),
          senderType: m === 0 ? 'CUSTOMER' : faker.helpers.arrayElement(['CUSTOMER', 'ADMIN']),
          senderId: m === 0 || m % 2 === 0 ? customer.id : adminUser.id,
          senderName: m === 0 || m % 2 === 0 ? customer.name : 'Support Team',
          createdAt: faker.date.recent({ days: 20 }),
        },
      })
    }
  }
  
  console.log(`   ✅ Created ${ticketCustomers.length} support tickets`)

  // ============================================
  // 15. SEED FINANCIAL DATA
  // ============================================
  console.log('\n💰 Seeding Financial Data...')
  
  // Expense categories
  const expenseCategories = [
    { name: 'Inventory & COGS', slug: 'inventory-cogs', description: 'Cost of goods sold', color: '#EF4444', icon: 'Package' },
    { name: 'Shipping & Fulfillment', slug: 'shipping-fulfillment', description: 'Shipping costs', color: '#3B82F6', icon: 'Truck' },
    { name: 'Marketing & Advertising', slug: 'marketing', description: 'Ads and promotions', color: '#8B5CF6', icon: 'Megaphone' },
    { name: 'Platform & Software', slug: 'software', description: 'SaaS and tools', color: '#10B981', icon: 'Monitor' },
    { name: 'Operations', slug: 'operations', description: 'General operations', color: '#F59E0B', icon: 'Settings' },
  ]
  
  const expenseCatIds: Record<string, string> = {}
  for (const cat of expenseCategories) {
    const created = await prisma.expense_categories.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { id: generateId(), ...cat, isActive: true },
    })
    expenseCatIds[cat.slug] = created.id
  }
  console.log(`   ✅ Created ${expenseCategories.length} expense categories`)
  
  // Expenses
  for (let i = 0; i < 50; i++) {
    const catSlug = faker.helpers.arrayElement(Object.keys(expenseCatIds))
    await prisma.expenses.create({
      data: {
        id: generateId(),
        categoryId: expenseCatIds[catSlug],
        description: faker.commerce.productName() + ' - ' + faker.helpers.arrayElement(['Monthly', 'Quarterly', 'One-time']),
        amount: faker.number.float({ min: 50, max: 2000, fractionDigits: 2 }),
        date: faker.date.recent({ days: 90 }),
        vendor: faker.company.name(),
        isTaxDeductible: faker.datatype.boolean({ probability: 0.7 }),
        status: faker.helpers.arrayElement(['RECORDED', 'PENDING_APPROVAL', 'APPROVED']) as 'RECORDED' | 'PENDING_APPROVAL' | 'APPROVED',
      },
    })
  }
  console.log(`   ✅ Created 50 expenses`)
  
  // Invoices
  for (let i = 0; i < 15; i++) {
    const subtotal = faker.number.float({ min: 500, max: 5000, fractionDigits: 2 })
    const tax = subtotal * 0.08
    await prisma.invoices.create({
      data: {
        id: generateId(),
        invoiceNumber: `INV-${faker.string.numeric(6)}`,
        vendorName: faker.company.name(),
        vendorEmail: faker.internet.email(),
        description: faker.commerce.productDescription(),
        subtotal,
        tax,
        total: subtotal + tax,
        issueDate: faker.date.recent({ days: 60 }),
        dueDate: faker.date.soon({ days: 30 }),
        status: faker.helpers.arrayElement(['PENDING', 'PAID', 'OVERDUE']) as 'PENDING' | 'PAID' | 'OVERDUE',
        paidDate: faker.datatype.boolean({ probability: 0.5 }) ? faker.date.recent({ days: 30 }) : null,
      },
    })
  }
  console.log(`   ✅ Created 15 invoices`)
  
  // Budgets
  for (const catSlug of Object.keys(expenseCatIds)) {
    await prisma.budgets.create({
      data: {
        id: generateId(),
        categoryId: expenseCatIds[catSlug],
        name: `${catSlug.replace('-', ' ')} Budget`,
        amount: faker.number.float({ min: 1000, max: 10000, fractionDigits: 2 }),
        period: 'MONTHLY',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        isActive: true,
      },
    })
  }
  console.log(`   ✅ Created ${Object.keys(expenseCatIds).length} budgets`)
  
  // Tax records
  const currentYear = new Date().getFullYear()
  for (let q = 1; q <= 4; q++) {
    const grossRevenue = faker.number.float({ min: 20000, max: 50000, fractionDigits: 2 })
    const expenses = grossRevenue * faker.number.float({ min: 0.3, max: 0.5 })
    try {
      await prisma.tax_records.create({
        data: {
          id: generateId(),
          period: 'QUARTERLY',
          year: currentYear,
          quarter: q,
          month: q * 3, // End month of quarter
          grossRevenue,
          taxableRevenue: grossRevenue * 0.9,
          salesTaxCollected: grossRevenue * 0.08,
          totalExpenses: expenses,
          deductibleExpenses: expenses * 0.8,
          netIncome: grossRevenue - expenses,
          estimatedTaxLiability: (grossRevenue - expenses) * 0.25,
          status: q < 4 ? 'FILED' : 'DRAFT',
        },
      })
    } catch {
      // Skip if already exists
    }
  }
  console.log(`   ✅ Created 4 quarterly tax records`)

  // ============================================
  // 16. SEED LOYALTY SETTINGS
  // ============================================
  console.log('\n⚙️  Seeding Loyalty Settings...')
  await prisma.loyalty_settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      isEnabled: true,
      programName: 'Care Points',
      pointsPerDollar: 10,
      referralPointsReferrer: 500,
      referralPointsReferred: 250,
      reviewPointsEnabled: true,
      reviewPointsAmount: 25,
      birthdayRewardsEnabled: true,
      birthdayRewardType: 'points',
      birthdayRewardValue: 200,
    },
  })
  console.log(`   ✅ Loyalty settings configured`)

  // ============================================
  // 17. SEED SALES GOALS
  // ============================================
  console.log('\n🎯 Seeding Sales Goals...')
  await prisma.sales_goals.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      dailyTarget: 500,
      weeklyTarget: 3500,
      monthlyTarget: 15000,
      quarterlyTarget: 45000,
      yearlyTarget: 180000,
    },
  })
  console.log(`   ✅ Sales goals configured`)

  // ============================================
  // 18. SEED PRODUCT VIEWS
  // ============================================
  console.log('\n👁️  Seeding Product Views...')
  
  for (const customer of customers.slice(0, 60)) {
    const viewedProducts = faker.helpers.arrayElements(products, { min: 2, max: 8 })
    for (const product of viewedProducts) {
      await prisma.product_views.create({
        data: {
          id: generateId(),
          productId: product.id,
          customerId: customer.id,
          viewedAt: faker.date.recent({ days: 30 }),
          duration: faker.number.int({ min: 5, max: 300 }),
          source: faker.helpers.arrayElement(['direct', 'search', 'collection', 'recommendation']),
        },
      })
    }
  }
  console.log(`   ✅ Created product views`)

  // ============================================
  // 19. SEED REFERRAL CODES
  // ============================================
  console.log('\n🔗 Seeding Referral Codes...')
  
  for (const customer of customers.slice(0, 30)) {
    try {
      await prisma.referral_codes.create({
        data: {
          id: generateId(),
          customerId: customer.id,
          code: `REF-${customer.name.split(' ')[0].toUpperCase()}-${faker.string.alphanumeric(4).toUpperCase()}`,
          timesUsed: faker.number.int({ min: 0, max: 5 }),
        },
      })
    } catch {
      // Skip if customer already has referral code
    }
  }
  console.log(`   ✅ Created referral codes`)

  // ============================================
  // 20. SEED NEWSLETTER SUBSCRIBERS
  // ============================================
  console.log('\n📧 Seeding Newsletter Subscribers...')
  
  // Add customers who opted in
  for (const customer of customers.filter(c => faker.datatype.boolean({ probability: 0.7 }))) {
    try {
      await prisma.newsletter_subscribers.create({
        data: {
          id: generateId(),
          email: customer.email,
          isActive: true,
          isVerified: faker.datatype.boolean({ probability: 0.8 }),
          source: 'checkout',
        },
      })
    } catch {
      // Skip duplicates
    }
  }
  // Add some non-customer subscribers
  for (let i = 0; i < 30; i++) {
    try {
      await prisma.newsletter_subscribers.create({
        data: {
          id: generateId(),
          email: faker.internet.email().toLowerCase(),
          isActive: true,
          isVerified: faker.datatype.boolean({ probability: 0.6 }),
          source: faker.helpers.arrayElement(['footer', 'popup', 'landing_page']),
        },
      })
    } catch {
      // Skip duplicates
    }
  }
  console.log(`   ✅ Created newsletter subscribers`)

  // ============================================
  // 21. SEED PROMOTIONS
  // ============================================
  console.log('\n🎁 Seeding Promotions...')
  
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
  ]

  for (const promo of promotions) {
    await prisma.promotion.upsert({
      where: { id: promo.id },
      update: promo,
      create: promo,
    })
  }
  console.log(`   ✅ Created ${promotions.length} promotions`)

  // ============================================
  // 22. SEED MARKETING POPUPS
  // ============================================
  console.log('\n📢 Seeding Marketing Popups...')

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
      promotionId: null,
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
  }
  console.log(`   ✅ Created ${popups.length} marketing popups`)

  // Create some popup analytics data
  const popupAnalytics = []
  for (const popup of popups) {
    // Generate analytics for the past 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      popupAnalytics.push({
        id: generateId(),
        popupId: popup.id,
        date,
        impressions: faker.number.int({ min: 50, max: 500 }),
        clicks: faker.number.int({ min: 10, max: 100 }),
        dismissals: faker.number.int({ min: 20, max: 150 }),
        conversions: faker.number.int({ min: 2, max: 30 }),
      })
    }
  }

  for (const analytics of popupAnalytics) {
    try {
      await prisma.popupAnalytics.create({ data: analytics })
    } catch {
      // Skip duplicates
    }
  }
  console.log(`   ✅ Created popup analytics data`)

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log('\n' + '═'.repeat(70))
  console.log('🎉 MASTER SEED COMPLETE!')
  console.log('═'.repeat(70))
  
  const stats = {
    adminUsers: await prisma.admin_users.count(),
    categories: await prisma.categories.count(),
    collections: await prisma.collections.count(),
    products: await prisma.products.count(),
    variants: await prisma.product_variants.count(),
    customers: await prisma.customers.count(),
    addresses: await prisma.addresses.count(),
    orders: await prisma.orders.count(),
    orderItems: await prisma.order_items.count(),
    loyaltyTiers: await prisma.loyalty_tiers.count(),
    rewards: await prisma.rewards.count(),
    pointsTransactions: await prisma.points_transactions.count(),
    rewardRedemptions: await prisma.reward_redemptions.count(),
    abandonedCarts: await prisma.abandoned_carts.count(),
    reviews: await prisma.reviews.count(),
    wishlistItems: await prisma.wishlist_items.count(),
    supportTickets: await prisma.support_tickets.count(),
    expenseCategories: await prisma.expense_categories.count(),
    expenses: await prisma.expenses.count(),
    invoices: await prisma.invoices.count(),
    budgets: await prisma.budgets.count(),
    taxRecords: await prisma.tax_records.count(),
    productViews: await prisma.product_views.count(),
    referralCodes: await prisma.referral_codes.count(),
    newsletterSubscribers: await prisma.newsletter_subscribers.count(),
    promotions: await prisma.promotion.count(),
    marketingPopups: await prisma.marketingPopup.count(),
    popupAnalytics: await prisma.popupAnalytics.count(),
  }
  
  console.log('\n📊 DATABASE STATS:')
  console.log('─'.repeat(40))
  Object.entries(stats).forEach(([key, value]) => {
    console.log(`   ${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`)
  })
  
  console.log('\n👥 CUSTOMER TIER DISTRIBUTION:')
  console.log('─'.repeat(40))
  const newcomers = await prisma.customers.count({ where: { loyaltyTierId: 'tier-newcomer' } })
  const friends = await prisma.customers.count({ where: { loyaltyTierId: 'tier-friend' } })
  const besties = await prisma.customers.count({ where: { loyaltyTierId: 'tier-bestie' } })
  const soulmates = await prisma.customers.count({ where: { loyaltyTierId: 'tier-soulmate' } })
  console.log(`   Newcomers: ${newcomers}`)
  console.log(`   Friends: ${friends}`)
  console.log(`   Besties: ${besties}`)
  console.log(`   Soulmates: ${soulmates}`)
  
  console.log('\n🔐 TEST CREDENTIALS:')
  console.log('─'.repeat(40))
  console.log('   Admin Dashboard: http://localhost:3000/admin')
  console.log('   Admin Email: kommandernando@outlook.com')
  console.log('   Admin Password: Nando1220@')
  console.log('')
  console.log('   Customer Login (all use password: password123):')
  customers.slice(0, 3).forEach(c => console.log(`   - ${c.email} (${tiers.find(t => t.id === c.tierId)?.name})`))
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
