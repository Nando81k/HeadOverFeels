/**
 * Comprehensive Seed Script - 100 Users with Full Data
 * 
 * This script seeds:
 * - 100 customers distributed across loyalty tiers
 * - Products with high-quality images from Unsplash
 * - Orders with tracking data for many customers
 * - Abandoned carts, wishlist items, and reviews
 * 
 * Run with: npx tsx scripts/seed-100-users.ts
 */

import { PrismaClient, OrderStatus, PaymentStatus } from '@prisma/client'
import { faker } from '@faker-js/faker'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ========================================
// HELPERS
// ========================================

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

interface TrackingEvent {
  status: string
  location: string
  timestamp: string
  description: string
}

function generateTrackingHistory(status: OrderStatus, carrier: string): TrackingEvent[] {
  const events: TrackingEvent[] = []
  const baseDate = faker.date.recent({ days: 14 })
  
  const statuses: { status: string; offset: number; description: string }[] = [
    { status: 'ORDER_PLACED', offset: 0, description: 'Order placed and payment confirmed' },
    { status: 'PROCESSING', offset: 1, description: 'Order being prepared for shipment' },
    { status: 'SHIPPED', offset: 2, description: `Package shipped via ${carrier}` },
    { status: 'IN_TRANSIT', offset: 3, description: 'Package in transit to destination' },
    { status: 'OUT_FOR_DELIVERY', offset: 5, description: 'Out for delivery' },
    { status: 'DELIVERED', offset: 6, description: 'Package delivered successfully' },
  ]

  const statusIndex = {
    'PENDING': 0,
    'CONFIRMED': 0,
    'PROCESSING': 2,
    'SHIPPED': 3,
    'IN_TRANSIT': 4,
    'OUT_FOR_DELIVERY': 5,
    'DELIVERED': 6,
    'CANCELLED': 0,
    'REFUNDED': 0,
  }

  const endIndex = statusIndex[status] || 0
  const cities = ['Los Angeles, CA', 'Phoenix, AZ', 'Dallas, TX', 'Memphis, TN', 'Louisville, KY', 'Local Facility']

  for (let i = 0; i <= endIndex; i++) {
    if (i < statuses.length) {
      const eventDate = new Date(baseDate)
      eventDate.setDate(eventDate.getDate() + statuses[i].offset)
      
      events.push({
        status: statuses[i].status,
        location: i < cities.length ? cities[i] : faker.location.city() + ', ' + faker.location.state({ abbreviated: true }),
        timestamp: eventDate.toISOString(),
        description: statuses[i].description,
      })
    }
  }

  return events
}

// High-quality product images from Unsplash
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
  console.log('\n' + '═'.repeat(60))
  console.log('🌱 HEAD OVER FEELS - 100 USERS SEED SCRIPT')
  console.log('═'.repeat(60))
  
  const defaultPassword = await bcrypt.hash('password123', 10)
  
  // ============================================
  // 1. SEED CATEGORIES
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
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, sortOrder: i, isActive: true },
    })
    categories[cat.slug] = created.id
    console.log(`   ✅ ${cat.name}`)
  }

  // ============================================
  // 2. SEED COLLECTIONS
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
    const created = await prisma.collection.upsert({
      where: { slug: coll.slug },
      update: {},
      create: { ...coll, sortOrder: i, isActive: true },
    })
    collections[coll.slug] = created.id
    console.log(`   ✅ ${coll.name}`)
  }

  // ============================================
  // 3. SEED PRODUCTS WITH HIGH-QUALITY IMAGES
  // ============================================
  console.log('\n📦 Seeding Products with Images...')
  
  const productDefinitions = [
    // Hoodies
    { name: 'Comfort Cloud Hoodie', slug: 'comfort-cloud-hoodie', category: 'hoodies', price: 89.99, compareAt: 110, images: PRODUCT_IMAGES.hoodies.slice(0, 3), featured: true },
    { name: 'Urban Edge Hoodie', slug: 'urban-edge-hoodie', category: 'hoodies', price: 79.99, compareAt: null, images: PRODUCT_IMAGES.hoodies.slice(1, 4), featured: true },
    { name: 'Vintage Wash Hoodie', slug: 'vintage-wash-hoodie', category: 'hoodies', price: 94.99, compareAt: 120, images: PRODUCT_IMAGES.hoodies.slice(2, 5), featured: false },
    { name: 'Oversized Fleece Hoodie', slug: 'oversized-fleece-hoodie', category: 'hoodies', price: 99.99, compareAt: null, images: [PRODUCT_IMAGES.hoodies[3], PRODUCT_IMAGES.hoodies[4]], featured: true },
    { name: 'Limited Drop Hoodie', slug: 'limited-drop-hoodie', category: 'hoodies', price: 129.99, compareAt: null, images: PRODUCT_IMAGES.hoodies, isLimited: true, maxQty: 50 },
    
    // T-Shirts
    { name: 'Essential Crew Tee', slug: 'essential-crew-tee', category: 'tshirts', price: 34.99, compareAt: null, images: PRODUCT_IMAGES.tshirts.slice(0, 2), featured: true },
    { name: 'Premium Cotton Tee', slug: 'premium-cotton-tee', category: 'tshirts', price: 39.99, compareAt: 50, images: PRODUCT_IMAGES.tshirts.slice(1, 3), featured: true },
    { name: 'Graphic Print Tee', slug: 'graphic-print-tee', category: 'tshirts', price: 44.99, compareAt: null, images: PRODUCT_IMAGES.tshirts.slice(2, 4), featured: false },
    { name: 'Relaxed Fit Tee', slug: 'relaxed-fit-tee', category: 'tshirts', price: 36.99, compareAt: null, images: PRODUCT_IMAGES.tshirts.slice(3, 5), featured: false },
    { name: 'Limited Edition Tee', slug: 'limited-edition-tee', category: 'tshirts', price: 59.99, compareAt: null, images: PRODUCT_IMAGES.tshirts, isLimited: true, maxQty: 100 },
    
    // Joggers
    { name: 'Classic Joggers', slug: 'classic-joggers', category: 'bottoms', price: 69.99, compareAt: 85, images: PRODUCT_IMAGES.joggers.slice(0, 2), featured: true },
    { name: 'Tech Fleece Joggers', slug: 'tech-fleece-joggers', category: 'bottoms', price: 79.99, compareAt: null, images: PRODUCT_IMAGES.joggers.slice(1, 3), featured: true },
    { name: 'Slim Fit Joggers', slug: 'slim-fit-joggers', category: 'bottoms', price: 74.99, compareAt: null, images: PRODUCT_IMAGES.joggers.slice(2, 4), featured: false },
    
    // Accessories
    { name: 'Canvas Tote Bag', slug: 'canvas-tote-bag', category: 'accessories', price: 29.99, compareAt: null, images: PRODUCT_IMAGES.accessories.slice(0, 2), featured: true },
    { name: 'Embroidered Cap', slug: 'embroidered-cap', category: 'accessories', price: 24.99, compareAt: 35, images: PRODUCT_IMAGES.accessories.slice(1, 3), featured: false },
    { name: 'Beanie', slug: 'cozy-knit-beanie', category: 'accessories', price: 22.99, compareAt: null, images: PRODUCT_IMAGES.accessories.slice(2, 4), featured: false },
    { name: 'Socks 3-Pack', slug: 'comfort-socks-3pack', category: 'accessories', price: 19.99, compareAt: null, images: [PRODUCT_IMAGES.accessories[3]], featured: false },
  ]
  
  const products: { id: string; name: string; price: number; variants: { id: string; size?: string; color?: string }[] }[] = []
  
  for (const prod of productDefinitions) {
    const categoryId = categories[prod.category]
    const releaseDate = prod.isLimited ? faker.date.recent({ days: 7 }) : null
    const dropEndDate = prod.isLimited ? faker.date.soon({ days: 14 }) : null
    
    const product = await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {
        images: JSON.stringify(prod.images),
        price: prod.price,
        compareAtPrice: prod.compareAt,
        isFeatured: prod.featured,
      },
      create: {
        name: prod.name,
        slug: prod.slug,
        description: faker.commerce.productDescription(),
        price: prod.price,
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
    
    // Create variants
    const variants: { id: string; size?: string; color?: string }[] = []
    const colorsToUse = faker.helpers.arrayElements(COLORS, { min: 2, max: 4 })
    const sizesToUse = prod.category === 'accessories' ? ['One Size'] : SIZES
    
    for (const color of colorsToUse) {
      for (const size of sizesToUse) {
        const sku = `${prod.slug}-${color.name.toLowerCase().replace(/\s/g, '-')}-${size.toLowerCase()}`
        const variant = await prisma.productVariant.upsert({
          where: { sku },
          update: { inventory: faker.number.int({ min: 5, max: 100 }) },
          create: {
            productId: product.id,
            sku,
            size,
            color: color.name,
            colorHex: color.hex,
            inventory: faker.number.int({ min: 5, max: 100 }),
            isActive: true,
          },
        })
        variants.push({ id: variant.id, size, color: color.name })
      }
    }
    
    products.push({ id: product.id, name: product.name, price: product.price, variants })
    console.log(`   ✅ ${product.name} (${variants.length} variants)`)
  }

  // Add products to collections
  console.log('\n🔗 Linking Products to Collections...')
  const newArrivals = products.slice(-5)
  const bestSellers = products.slice(0, 5)
  const saleItems = products.filter(p => productDefinitions.find(pd => pd.name === p.name)?.compareAt)
  const limitedItems = products.filter(p => productDefinitions.find(pd => pd.name === p.name)?.isLimited)
  
  for (const prod of newArrivals) {
    await prisma.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId: collections['new-arrivals'], productId: prod.id } },
      update: {},
      create: { collectionId: collections['new-arrivals'], productId: prod.id },
    })
  }
  for (const prod of bestSellers) {
    await prisma.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId: collections['best-sellers'], productId: prod.id } },
      update: {},
      create: { collectionId: collections['best-sellers'], productId: prod.id },
    })
  }
  for (const prod of saleItems) {
    await prisma.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId: collections['sale'], productId: prod.id } },
      update: {},
      create: { collectionId: collections['sale'], productId: prod.id },
    })
  }
  for (const prod of limitedItems) {
    await prisma.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId: collections['limited-edition'], productId: prod.id } },
      update: {},
      create: { collectionId: collections['limited-edition'], productId: prod.id },
    })
  }
  console.log(`   ✅ Linked products to 4 collections`)

  // ============================================
  // 4. SEED LOYALTY TIERS
  // ============================================
  console.log('\n🏆 Seeding Loyalty Tiers...')
  const tiers = [
    { id: 'tier-newcomer', name: 'Newcomer', slug: 'newcomer', minAnnualSpend: 0, minAnnualPoints: 0, pointMultiplier: 1.0, freeShipping: false, earlyDropAccess: false, sortOrder: 0, perks: JSON.stringify(['Earn 10 Care Points per $1 spent', 'Birthday surprise', 'Early sale access']) },
    { id: 'tier-friend', name: 'Friend', slug: 'friend', minAnnualSpend: 100, minAnnualPoints: 1000, pointMultiplier: 1.25, freeShipping: false, earlyDropAccess: false, sortOrder: 1, perks: JSON.stringify(['Earn 12.5 Care Points per $1 spent (1.25x)', 'Birthday bonus points', 'Early access to sales', 'Free shipping on orders $75+']) },
    { id: 'tier-bestie', name: 'Bestie', slug: 'bestie', minAnnualSpend: 300, minAnnualPoints: 3000, pointMultiplier: 1.5, freeShipping: true, earlyDropAccess: false, sortOrder: 2, perks: JSON.stringify(['Earn 15 Care Points per $1 spent (1.5x)', 'FREE shipping on all orders', '24-hour early access to sales', 'Exclusive Bestie-only products']) },
    { id: 'tier-soulmate', name: 'Soulmate', slug: 'soulmate', minAnnualSpend: 750, minAnnualPoints: 7500, pointMultiplier: 2.0, freeShipping: true, earlyDropAccess: true, sortOrder: 3, perks: JSON.stringify(['Earn 20 Care Points per $1 spent (2x)', 'FREE express shipping', '48-hour early access to limited drops', 'Annual surprise gift', 'Priority support']) },
  ]
  
  for (const tier of tiers) {
    await prisma.loyaltyTier.upsert({
      where: { id: tier.id },
      update: tier,
      create: { ...tier, isActive: true },
    })
    console.log(`   ✅ ${tier.name} (${tier.minAnnualSpend}+ annual spend)`)
  }

  // ============================================
  // 5. SEED 100 CUSTOMERS
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
    addressId?: string
  }
  
  const customers: CustomerData[] = []
  let customerCounter = 0
  
  for (const tierDist of tierDistribution) {
    const tier = tiers.find(t => t.id === tierDist.tierId)!
    
    for (let i = 0; i < tierDist.count; i++) {
      customerCounter++
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()
      const email = faker.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase()
      const totalSpent = faker.number.float({ min: tierDist.minSpend, max: tierDist.maxSpend, fractionDigits: 2 })
      const totalOrders = Math.max(1, Math.floor(totalSpent / 50))
      const lifetimePoints = Math.floor(totalSpent * tier.pointMultiplier * 10)
      const currentPoints = Math.floor(lifetimePoints * faker.number.float({ min: 0.3, max: 0.8 }))
      
      const customer = await prisma.customer.upsert({
        where: { email },
        update: {},
        create: {
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
      const address = await prisma.address.create({
        data: {
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
        addressId: address.id,
      })
    }
    
    console.log(`   ✅ ${tierDist.count} ${tier.name} customers`)
  }
  console.log(`   📊 Total: ${customers.length} customers`)

  // ============================================
  // 6. SEED ORDERS WITH TRACKING DATA
  // ============================================
  console.log('\n📦 Seeding Orders with Tracking Data...')
  
  let orderCounter = 1000
  const orderStatuses: OrderStatus[] = ['DELIVERED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PROCESSING', 'PENDING']
  const statusWeights = [40, 20, 15, 10, 10, 5] // More delivered orders
  
  // Create orders for customers who have totalOrders > 0
  const ordersCreated: string[] = []
  
  for (const customer of customers) {
    const numOrders = Math.min(customer.totalOrders, faker.number.int({ min: 1, max: 5 }))
    
    for (let o = 0; o < numOrders; o++) {
      orderCounter++
      const orderNumber = generateOrderNumber(orderCounter)
      
      // Pick random status based on weights
      const statusRoll = faker.number.int({ min: 1, max: 100 })
      let cumulative = 0
      let status: OrderStatus = 'DELIVERED'
      for (let s = 0; s < orderStatuses.length; s++) {
        cumulative += statusWeights[s]
        if (statusRoll <= cumulative) {
          status = orderStatuses[s]
          break
        }
      }
      
      const carrier = faker.helpers.arrayElement(CARRIERS)
      const hasTracking = ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)
      const trackingNumber = hasTracking ? generateTrackingNumber(carrier) : null
      const trackingHistory = hasTracking ? generateTrackingHistory(status, carrier) : null
      
      // Pick 1-3 random products
      const numItems = faker.number.int({ min: 1, max: 3 })
      const orderProducts = faker.helpers.arrayElements(products, numItems)
      
      let subtotal = 0
      const items: { productId: string; variantId: string; quantity: number; price: number; name: string }[] = []
      
      for (const prod of orderProducts) {
        const variant = faker.helpers.arrayElement(prod.variants)
        const quantity = faker.number.int({ min: 1, max: 2 })
        const price = prod.price
        subtotal += price * quantity
        items.push({
          productId: prod.id,
          variantId: variant.id,
          quantity,
          price,
          name: prod.name,
        })
      }
      
      const shipping = subtotal >= 75 ? 0 : 7.99
      const tax = subtotal * 0.08
      const discount = faker.datatype.boolean({ probability: 0.2 }) ? subtotal * 0.15 : 0
      const total = subtotal + shipping + tax - discount
      
      const paymentStatus: PaymentStatus = ['DELIVERED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(status) 
        ? 'PAID' 
        : status === 'PROCESSING' 
          ? 'PAID' 
          : 'PENDING'
      
      const createdAt = faker.date.recent({ days: 30 })
      const estimatedDelivery = new Date(createdAt)
      estimatedDelivery.setDate(estimatedDelivery.getDate() + faker.number.int({ min: 3, max: 7 }))
      
      try {
        const order = await prisma.order.create({
          data: {
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
        
        // Create order items
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx]
          const prod = products.find(p => p.id === item.productId)!
          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              productVariantId: item.variantId,
              quantity: item.quantity,
              price: item.price,
              productName: item.name,
              productImage: JSON.parse((await prisma.product.findUnique({ where: { id: item.productId }, select: { images: true } }))?.images || '[]')[0] || null,
              variantDetails: prod.variants.find(v => v.id === item.variantId)?.size || '',
            },
          })
        }
        
        ordersCreated.push(orderNumber)
      } catch {
        // Skip duplicate order numbers
      }
    }
  }
  
  console.log(`   ✅ Created ${ordersCreated.length} orders with tracking data`)
  
  // Show sample order numbers for testing
  const deliveredOrders = await prisma.order.findMany({
    where: { status: 'DELIVERED' },
    take: 5,
    select: { orderNumber: true },
  })
  const shippedOrders = await prisma.order.findMany({
    where: { status: 'SHIPPED' },
    take: 3,
    select: { orderNumber: true },
  })
  
  console.log('\n📋 Sample Orders for Testing:')
  console.log('   Delivered:', deliveredOrders.map(o => o.orderNumber).join(', '))
  console.log('   Shipped:', shippedOrders.map(o => o.orderNumber).join(', '))

  // ============================================
  // 7. SEED ABANDONED CARTS
  // ============================================
  console.log('\n🛒 Seeding Abandoned Carts...')
  
  // Create abandoned carts for 15 random customers
  const customersForAbandoned = faker.helpers.arrayElements(customers, 15)
  
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
    
    await prisma.abandonedCart.create({
      data: {
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
  // 8. SEED REVIEWS
  // ============================================
  console.log('\n⭐ Seeding Reviews...')
  
  // Create 30-40 reviews
  const reviewCount = faker.number.int({ min: 30, max: 40 })
  const reviewCustomers = faker.helpers.arrayElements(customers.filter(c => c.totalOrders > 0), reviewCount)
  
  for (const customer of reviewCustomers) {
    const product = faker.helpers.arrayElement(products)
    const rating = faker.helpers.weightedArrayElement([
      { weight: 50, value: 5 },
      { weight: 30, value: 4 },
      { weight: 15, value: 3 },
      { weight: 4, value: 2 },
      { weight: 1, value: 1 },
    ])
    
    await prisma.review.create({
      data: {
        productId: product.id,
        customerId: customer.id,
        customerName: customer.name.split(' ')[0] + ' ' + customer.name.split(' ')[1]?.[0] + '.',
        customerEmail: customer.email,
        rating,
        title: faker.helpers.arrayElement([
          'Love it!', 'Great quality', 'Perfect fit', 'Highly recommend',
          'Good value', 'Nice material', 'As expected', 'Would buy again',
          'Super comfortable', 'True to size', 'Amazing!', 'Worth the price',
        ]),
        comment: faker.lorem.sentences({ min: 1, max: 3 }),
        isVerified: faker.datatype.boolean({ probability: 0.8 }),
        status: faker.helpers.weightedArrayElement([
          { weight: 80, value: 'APPROVED' as const },
          { weight: 15, value: 'PENDING' as const },
          { weight: 5, value: 'REJECTED' as const },
        ]),
        helpfulCount: faker.number.int({ min: 0, max: 25 }),
      },
    })
  }
  
  console.log(`   ✅ Created ${reviewCount} product reviews`)

  // ============================================
  // 9. SEED WISHLIST ITEMS
  // ============================================
  console.log('\n❤️  Seeding Wishlist Items...')
  
  const wishlistCustomers = faker.helpers.arrayElements(customers, 40)
  let wishlistCount = 0
  
  for (const customer of wishlistCustomers) {
    const wishProducts = faker.helpers.arrayElements(products, { min: 1, max: 4 })
    for (const product of wishProducts) {
      try {
        await prisma.wishlistItem.create({
          data: {
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
  // 10. SEED POINTS TRANSACTIONS
  // ============================================
  console.log('\n💎 Seeding Points Transactions...')
  
  let ptxCount = 0
  
  // Get recent orders for points transactions
  const recentOrders = await prisma.order.findMany({
    where: { paymentStatus: 'PAID' },
    take: 50,
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  })
  
  for (const order of recentOrders) {
    if (order.customer) {
      const tier = tiers.find(t => t.id === order.customer!.loyaltyTierId)
      const pointsEarned = Math.floor(order.total * (tier?.pointMultiplier || 1) * 10)
      
      await prisma.pointsTransaction.create({
        data: {
          customerId: order.customer.id,
          orderId: order.id,
          points: pointsEarned,
          type: 'PURCHASE',
          description: `Points earned from order ${order.orderNumber}`,
        },
      })
      ptxCount++
    }
  }
  
  // Add some signup bonuses
  for (const customer of customers.slice(0, 20)) {
    await prisma.pointsTransaction.create({
      data: {
        customerId: customer.id,
        points: 100,
        type: 'ACCOUNT_CREATION',
        description: 'Welcome bonus for joining Care Points program',
      },
    })
    ptxCount++
  }
  
  console.log(`   ✅ Created ${ptxCount} points transactions`)

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log('\n' + '═'.repeat(60))
  console.log('🎉 SEED COMPLETE!')
  console.log('═'.repeat(60))
  
  const stats = {
    categories: await prisma.category.count(),
    collections: await prisma.collection.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    customers: await prisma.customer.count(),
    orders: await prisma.order.count(),
    abandonedCarts: await prisma.abandonedCart.count(),
    reviews: await prisma.review.count(),
    wishlistItems: await prisma.wishlistItem.count(),
    pointsTransactions: await prisma.pointsTransaction.count(),
  }
  
  console.log('\n📊 Database Stats:')
  console.log(`   • Categories: ${stats.categories}`)
  console.log(`   • Collections: ${stats.collections}`)
  console.log(`   • Products: ${stats.products}`)
  console.log(`   • Product Variants: ${stats.variants}`)
  console.log(`   • Customers: ${stats.customers}`)
  console.log(`   • Orders: ${stats.orders}`)
  console.log(`   • Abandoned Carts: ${stats.abandonedCarts}`)
  console.log(`   • Reviews: ${stats.reviews}`)
  console.log(`   • Wishlist Items: ${stats.wishlistItems}`)
  console.log(`   • Points Transactions: ${stats.pointsTransactions}`)
  
  console.log('\n👥 Customer Distribution:')
  const newcomers = await prisma.customer.count({ where: { loyaltyTierId: 'tier-newcomer' } })
  const friends = await prisma.customer.count({ where: { loyaltyTierId: 'tier-friend' } })
  const besties = await prisma.customer.count({ where: { loyaltyTierId: 'tier-bestie' } })
  const soulmates = await prisma.customer.count({ where: { loyaltyTierId: 'tier-soulmate' } })
  console.log(`   • Newcomers: ${newcomers}`)
  console.log(`   • Friends: ${friends}`)
  console.log(`   • Besties: ${besties}`)
  console.log(`   • Soulmates: ${soulmates}`)
  
  console.log('\n🔗 Test URLs:')
  console.log('   Admin Dashboard: http://localhost:3000/admin')
  console.log('   Products: http://localhost:3000/products')
  console.log('   Order Tracking: http://localhost:3000/order/track/[orderNumber]')
  console.log('\n🔐 Test Login:')
  console.log('   All customers use password: password123')
  console.log('   Sample emails:')
  customers.slice(0, 3).forEach(c => console.log(`   - ${c.email}`))
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
