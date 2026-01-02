import { config } from 'dotenv'
import { PrismaClient, OrderStatus, PaymentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local' })
}

const prisma = new PrismaClient()

// Realistic user data with varying personas
const userProfiles = [
  // VIP Customer - Overdrive tier material
  {
    email: 'marcus.chen@gmail.com',
    name: 'Marcus Chen',
    phone: '+1-415-555-0142',
    birthday: new Date('1992-03-15'),
    newsletter: true,
    smsOptIn: true,
    orderCount: 28,
    avgSpend: 145,
    pointsMultiplier: 2.0,
    joinedMonthsAgo: 18,
  },
  // Loyal Regular - Mind tier
  {
    email: 'sarah.williams@outlook.com',
    name: 'Sarah Williams',
    phone: '+1-312-555-0198',
    birthday: new Date('1995-07-22'),
    newsletter: true,
    smsOptIn: false,
    orderCount: 15,
    avgSpend: 95,
    pointsMultiplier: 1.5,
    joinedMonthsAgo: 14,
  },
  // Heart tier member
  {
    email: 'devon.taylor@yahoo.com',
    name: 'Devon Taylor',
    phone: '+1-646-555-0167',
    birthday: new Date('1998-11-08'),
    newsletter: true,
    smsOptIn: true,
    orderCount: 8,
    avgSpend: 78,
    pointsMultiplier: 1.25,
    joinedMonthsAgo: 10,
  },
  // Regular shopper - Heart tier
  {
    email: 'jordan.rivera@proton.me',
    name: 'Jordan Rivera',
    phone: '+1-213-555-0134',
    birthday: new Date('1994-05-30'),
    newsletter: true,
    smsOptIn: true,
    orderCount: 6,
    avgSpend: 112,
    pointsMultiplier: 1.25,
    joinedMonthsAgo: 8,
  },
  // New but engaged - Head tier
  {
    email: 'alexis.martinez@gmail.com',
    name: 'Alexis Martinez',
    phone: '+1-305-555-0178',
    birthday: new Date('2000-02-14'),
    newsletter: true,
    smsOptIn: false,
    orderCount: 3,
    avgSpend: 89,
    pointsMultiplier: 1.0,
    joinedMonthsAgo: 4,
  },
  // Occasional buyer - Head tier
  {
    email: 'cameron.lee@icloud.com',
    name: 'Cameron Lee',
    phone: '+1-206-555-0145',
    birthday: new Date('1997-09-03'),
    newsletter: false,
    smsOptIn: false,
    orderCount: 2,
    avgSpend: 65,
    pointsMultiplier: 1.0,
    joinedMonthsAgo: 6,
  },
  // Birthday coming up - Heart tier
  {
    email: 'taylor.johnson@gmail.com',
    name: 'Taylor Johnson',
    phone: '+1-404-555-0123',
    birthday: new Date('1996-01-08'), // Birthday in a few days
    newsletter: true,
    smsOptIn: true,
    orderCount: 7,
    avgSpend: 88,
    pointsMultiplier: 1.25,
    joinedMonthsAgo: 11,
  },
  // Window shopper turned customer
  {
    email: 'reese.anderson@hotmail.com',
    name: 'Reese Anderson',
    phone: null,
    birthday: null,
    newsletter: false,
    smsOptIn: false,
    orderCount: 1,
    avgSpend: 54,
    pointsMultiplier: 1.0,
    joinedMonthsAgo: 2,
  },
  // Big spender - Mind tier
  {
    email: 'morgan.patel@gmail.com',
    name: 'Morgan Patel',
    phone: '+1-617-555-0189',
    birthday: new Date('1991-12-25'),
    newsletter: true,
    smsOptIn: true,
    orderCount: 9,
    avgSpend: 156,
    pointsMultiplier: 1.5,
    joinedMonthsAgo: 9,
  },
  // Moderate buyer - Heart tier
  {
    email: 'avery.kim@gmail.com',
    name: 'Avery Kim',
    phone: '+1-510-555-0156',
    birthday: new Date('1999-08-17'),
    newsletter: true,
    smsOptIn: false,
    orderCount: 5,
    avgSpend: 72,
    pointsMultiplier: 1.25,
    joinedMonthsAgo: 7,
  },
  // Referred customer - new
  {
    email: 'quinn.nguyen@gmail.com',
    name: 'Quinn Nguyen',
    phone: '+1-832-555-0134',
    birthday: new Date('2001-04-11'),
    newsletter: true,
    smsOptIn: true,
    orderCount: 2,
    avgSpend: 95,
    pointsMultiplier: 1.0,
    joinedMonthsAgo: 1,
  },
  // Collection enthusiast - Mind tier
  {
    email: 'river.james@outlook.com',
    name: 'River James',
    phone: '+1-503-555-0167',
    birthday: new Date('1993-06-09'),
    newsletter: true,
    smsOptIn: true,
    orderCount: 12,
    avgSpend: 98,
    pointsMultiplier: 1.5,
    joinedMonthsAgo: 13,
  },
]

// Sample order statuses for realistic distribution
const orderStatusDistribution = [
  { status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID, weight: 70 },
  { status: OrderStatus.SHIPPED, paymentStatus: PaymentStatus.PAID, weight: 10 },
  { status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID, weight: 8 },
  { status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING, weight: 5 },
  { status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.REFUNDED, weight: 4 },
  { status: OrderStatus.REFUNDED, paymentStatus: PaymentStatus.REFUNDED, weight: 3 },
]

// Get weighted random status
function getRandomStatus() {
  const totalWeight = orderStatusDistribution.reduce((acc, s) => acc + s.weight, 0)
  let random = Math.random() * totalWeight
  
  for (const s of orderStatusDistribution) {
    random -= s.weight
    if (random <= 0) {
      return { status: s.status, paymentStatus: s.paymentStatus }
    }
  }
  return { status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID }
}

// Generate realistic order number
function generateOrderNumber(date: Date): string {
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 9000 + 1000)
  return `HOF-${year}${month}-${random}`
}

// Points transaction types with realistic distribution
const pointsTypes = [
  { type: 'PURCHASE', description: 'Purchase reward' },
  { type: 'BONUS', description: 'Welcome bonus' },
  { type: 'BIRTHDAY', description: 'Birthday bonus' },
  { type: 'REDEMPTION', description: 'Points redeemed' },
  { type: 'REFERRAL', description: 'Referral bonus' },
  { type: 'REVIEW', description: 'Review bonus' },
]

async function main() {
  console.log('🌱 Seeding realistic users and order history...\n')

  // Get existing products
  const products = await prisma.product.findMany({
    include: { variants: true },
    where: { isActive: true },
  })

  if (products.length === 0) {
    console.log('❌ No products found. Please run seed-products.ts first.')
    return
  }

  console.log(`📦 Found ${products.length} products to use in orders\n`)

  // Get loyalty tiers
  const tiers = await prisma.loyaltyTier.findMany({
    orderBy: { minAnnualSpend: 'asc' },
  })

  if (tiers.length === 0) {
    console.log('❌ No loyalty tiers found. Please run seed-loyalty.ts first.')
    return
  }

  // Create users with orders
  for (const profile of userProfiles) {
    console.log(`\n👤 Creating user: ${profile.name}`)
    
    const joinedDate = new Date()
    joinedDate.setMonth(joinedDate.getMonth() - profile.joinedMonthsAgo)
    
    // Create or update customer
    const hashedPassword = await bcrypt.hash('Customer123!', 10)
    
    const customer = await prisma.customer.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name,
        phone: profile.phone,
        birthday: profile.birthday,
        newsletter: profile.newsletter,
        smsOptIn: profile.smsOptIn,
      },
      create: {
        email: profile.email,
        password: hashedPassword,
        name: profile.name,
        phone: profile.phone,
        birthday: profile.birthday,
        newsletter: profile.newsletter,
        smsOptIn: profile.smsOptIn,
        createdAt: joinedDate,
      },
    })

    // Create address for customer
    const address = await prisma.address.upsert({
      where: {
        id: `${customer.id}-default`,
      },
      update: {},
      create: {
        id: `${customer.id}-default`,
        customerId: customer.id,
        firstName: profile.name.split(' ')[0],
        lastName: profile.name.split(' ')[1] || '',
        address1: `${Math.floor(Math.random() * 9000 + 100)} ${['Oak', 'Maple', 'Cedar', 'Pine', 'Elm'][Math.floor(Math.random() * 5)]} ${['St', 'Ave', 'Blvd', 'Dr'][Math.floor(Math.random() * 4)]}`,
        city: ['San Francisco', 'Los Angeles', 'New York', 'Chicago', 'Austin', 'Seattle', 'Miami', 'Boston'][Math.floor(Math.random() * 8)],
        state: ['CA', 'CA', 'NY', 'IL', 'TX', 'WA', 'FL', 'MA'][Math.floor(Math.random() * 8)],
        postalCode: Math.floor(Math.random() * 90000 + 10000).toString(),
        country: 'US',
        isDefault: true,
      },
    })

    // Generate orders for this customer
    let totalSpent = 0
    let totalPointsEarned = 0
    const orders = []

    for (let i = 0; i < profile.orderCount; i++) {
      // Spread orders over their membership period
      const orderDate = new Date(joinedDate)
      const daysSinceJoined = Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24))
      const randomDays = Math.floor(Math.random() * daysSinceJoined)
      orderDate.setDate(orderDate.getDate() + randomDays)

      // Random variation in order value
      const orderVariation = 0.5 + Math.random() // 0.5x to 1.5x average
      const orderSubtotal = Math.round(profile.avgSpend * orderVariation * 100) / 100
      const shipping = orderSubtotal > 100 ? 0 : 8.99
      const tax = Math.round(orderSubtotal * 0.0825 * 100) / 100
      const orderTotal = Math.round((orderSubtotal + shipping + tax) * 100) / 100

      const { status, paymentStatus } = getRandomStatus()
      
      // Only count completed orders
      if (status !== OrderStatus.CANCELLED && status !== OrderStatus.REFUNDED) {
        totalSpent += orderTotal
      }

      // Select random products for order
      const numItems = Math.min(Math.floor(Math.random() * 3) + 1, products.length)
      const selectedProducts = [...products].sort(() => Math.random() - 0.5).slice(0, numItems)
      
      const orderNumber = generateOrderNumber(orderDate)
      
      // Create order
      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          status,
          subtotal: orderSubtotal,
          discount: Math.random() > 0.8 ? Math.round(orderSubtotal * 0.1 * 100) / 100 : 0,
          shipping,
          tax,
          total: orderTotal,
          customerEmail: profile.email,
          customerPhone: profile.phone,
          shippingAddressId: address.id,
          billingAddressId: address.id,
          paymentMethod: 'card',
          paymentStatus,
          shippingMethod: shipping === 0 ? 'Free Shipping' : 'Standard',
          trackingNumber: status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED
            ? `1Z${Math.random().toString(36).substring(2, 10).toUpperCase()}`
            : null,
          carrier: status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED
            ? ['USPS', 'FedEx', 'UPS'][Math.floor(Math.random() * 3)]
            : null,
          shippedAt: status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED
            ? new Date(orderDate.getTime() + 2 * 24 * 60 * 60 * 1000) // 2 days after order
            : null,
          deliveredAt: status === OrderStatus.DELIVERED
            ? new Date(orderDate.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days after order
            : null,
          createdAt: orderDate,
          updatedAt: orderDate,
          items: {
            create: selectedProducts.map((product) => {
              const variant = product.variants[Math.floor(Math.random() * product.variants.length)]
              const quantity = Math.floor(Math.random() * 2) + 1
              // Handle images which could be JSON string or array
              let firstImage: string | null = null
              try {
                const images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images
                if (Array.isArray(images) && images.length > 0) {
                  // Handle both string URLs and object format
                  firstImage = typeof images[0] === 'string' ? images[0] : images[0]?.url || null
                }
              } catch {
                firstImage = null
              }
              return {
                productId: product.id,
                productVariantId: variant?.id,
                quantity,
                price: variant?.price || product.price,
                productName: product.name,
                productImage: firstImage,
                variantDetails: variant ? JSON.stringify({ size: variant.size, color: variant.color }) : null,
              }
            }),
          },
        },
      })

      orders.push(order)

      // Create points transaction for completed orders
      if (paymentStatus === PaymentStatus.PAID && status !== OrderStatus.CANCELLED && status !== OrderStatus.REFUNDED) {
        const pointsEarned = Math.round(orderTotal * profile.pointsMultiplier)
        totalPointsEarned += pointsEarned
        
        await prisma.pointsTransaction.create({
          data: {
            customerId: customer.id,
            orderId: order.id,
            type: 'PURCHASE',
            points: pointsEarned,
            description: `Earned from order ${orderNumber}`,
            createdAt: orderDate,
          },
        })
      }
    }

    // Add bonus points transactions
    // Welcome bonus (Account Creation)
    await prisma.pointsTransaction.create({
      data: {
        customerId: customer.id,
        type: 'ACCOUNT_CREATION',
        points: 50,
        description: 'Welcome bonus - account creation',
        createdAt: joinedDate,
      },
    })
    totalPointsEarned += 50

    // Birthday bonus (if birthday is in the past this year)
    if (profile.birthday) {
      const thisBirthday = new Date(profile.birthday)
      thisBirthday.setFullYear(new Date().getFullYear())
      
      if (thisBirthday < new Date() && thisBirthday > joinedDate) {
        await prisma.pointsTransaction.create({
          data: {
            customerId: customer.id,
            type: 'BIRTHDAY',
            points: 50,
            description: 'Birthday bonus',
            createdAt: thisBirthday,
          },
        })
        totalPointsEarned += 50
      }
    }

    // Occasional point redemptions for active users
    let redeemedPoints = 0
    if (profile.orderCount > 5 && totalPointsEarned > 200) {
      const redeemAmount = Math.floor(totalPointsEarned * 0.3) // Redeem 30%
      redeemedPoints = redeemAmount
      
      await prisma.pointsTransaction.create({
        data: {
          customerId: customer.id,
          type: 'REDEMPTION',
          points: -redeemAmount,
          description: 'Redeemed for discount',
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      })
    }

    // Review bonus for some users
    if (profile.orderCount > 3 && Math.random() > 0.5) {
      const reviewBonus = 25 * Math.floor(Math.random() * 3 + 1)
      totalPointsEarned += reviewBonus
      
      await prisma.pointsTransaction.create({
        data: {
          customerId: customer.id,
          type: 'REVIEW',
          points: reviewBonus,
          description: 'Review bonus',
          createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        },
      })
    }

    // Calculate tier based on annual spend
    const currentPoints = totalPointsEarned - redeemedPoints
    const annualSpend = totalSpent * (12 / profile.joinedMonthsAgo) // Projected annual
    
    // Find appropriate tier
    let customerTier = tiers[0] // Default to first tier
    for (const tier of tiers) {
      if (annualSpend >= tier.minAnnualSpend && !tier.isInviteOnly) {
        customerTier = tier
      }
    }

    // Update customer stats
    const lastOrder = orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalOrders: orders.filter(o => 
          o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.REFUNDED
        ).length,
        avgOrderValue: Math.round((totalSpent / profile.orderCount) * 100) / 100,
        lastOrderDate: lastOrder?.createdAt || null,
        currentPoints,
        lifetimePoints: totalPointsEarned,
        annualPointsEarned: Math.round(totalPointsEarned * (12 / profile.joinedMonthsAgo)),
        annualSpend: Math.round(annualSpend * 100) / 100,
        loyaltyTierId: customerTier.id,
      },
    })

    console.log(`   ✅ Created ${orders.length} orders, $${totalSpent.toFixed(2)} total spent`)
    console.log(`   💎 ${currentPoints} points (${totalPointsEarned} lifetime), ${customerTier.name} tier`)
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 SEEDING SUMMARY')
  console.log('='.repeat(50))
  
  const totalCustomers = await prisma.customer.count()
  const totalOrders = await prisma.order.count()
  const totalRevenue = await prisma.order.aggregate({
    _sum: { total: true },
    where: {
      status: {
        notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED],
      },
    },
  })
  
  console.log(`👥 Total Customers: ${totalCustomers}`)
  console.log(`📦 Total Orders: ${totalOrders}`)
  console.log(`💰 Total Revenue: $${(totalRevenue._sum.total || 0).toFixed(2)}`)
  
  // Tier distribution
  console.log('\n📈 Customer Tier Distribution:')
  for (const tier of tiers) {
    const count = await prisma.customer.count({
      where: { loyaltyTierId: tier.id },
    })
    console.log(`   ${tier.name}: ${count} customers`)
  }

  console.log('\n✨ Seeding complete!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
