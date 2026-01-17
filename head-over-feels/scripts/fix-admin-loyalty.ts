/**
 * Fix Admin Loyalty Data
 * 
 * This script ensures admin users have proper loyalty data and 
 * creates consistent data across all related tables.
 * 
 * Run with: npx tsx scripts/fix-admin-loyalty.ts
 */

import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'

const prisma = new PrismaClient()

async function fixAdminLoyalty() {
  console.log('\n' + '═'.repeat(60))
  console.log('🔧 FIXING ADMIN LOYALTY DATA')
  console.log('═'.repeat(60))

  // 1. Find admin users
  const admins = await prisma.customer.findMany({
    where: { isAdmin: true },
    include: { loyaltyTier: true },
  })

  console.log(`\n👤 Found ${admins.length} admin user(s)`)

  for (const admin of admins) {
    console.log(`\n   Processing: ${admin.email}`)

    // Assign to Soulmate tier (highest tier for admins)
    const soulmateTotal = 1500 // Soulmate spend level
    const lifetimePoints = 15000
    const currentPoints = 5000

    await prisma.customer.update({
      where: { id: admin.id },
      data: {
        loyaltyTierId: 'tier-soulmate',
        currentPoints,
        lifetimePoints,
        annualPointsEarned: 8000,
        totalSpent: soulmateTotal,
        annualSpend: soulmateTotal,
        totalOrders: 15,
        newsletter: true,
        smsOptIn: true,
        birthday: new Date('1990-06-15'),
      },
    })
    console.log(`   ✅ Assigned to Soulmate tier`)
    console.log(`   ✅ Set ${currentPoints.toLocaleString()} current points`)
    console.log(`   ✅ Set $${soulmateTotal.toLocaleString()} total spent`)

    // 2. Create address if none exists
    const existingAddress = await prisma.address.findFirst({
      where: { customerId: admin.id },
    })

    let addressId: string
    if (!existingAddress) {
      const address = await prisma.address.create({
        data: {
          customerId: admin.id,
          firstName: admin.name?.split(' ')[0] || 'Admin',
          lastName: admin.name?.split(' ')[1] || 'User',
          address1: '123 Admin Street',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
          isDefault: true,
        },
      })
      addressId = address.id
      console.log(`   ✅ Created default address`)
    } else {
      addressId = existingAddress.id
      console.log(`   ℹ️ Address already exists`)
    }

    // 3. Create orders for admin with points transactions
    const existingOrders = await prisma.order.count({
      where: { customerId: admin.id },
    })

    if (existingOrders === 0) {
      console.log(`\n   📦 Creating orders and points transactions...`)

      // Get some products
      const products = await prisma.product.findMany({
        take: 10,
        include: { variants: true },
      })

      if (products.length === 0) {
        console.log('   ⚠️ No products found - skipping order creation')
        continue
      }

      const orderStatuses = ['DELIVERED', 'DELIVERED', 'DELIVERED', 'SHIPPED', 'PROCESSING']
      let orderCounter = 5000

      for (let i = 0; i < 5; i++) {
        orderCounter++
        const orderNumber = `HOF-ADMIN-${orderCounter}`
        const status = orderStatuses[i]
        const product = faker.helpers.arrayElement(products)
        const variant = product.variants[0]

        const subtotal = product.price * 2
        const tax = subtotal * 0.08
        const shipping = 0 // Free shipping for soulmate
        const total = subtotal + tax

        const createdAt = faker.date.recent({ days: 60 - i * 10 })

        const order = await prisma.order.create({
          data: {
            orderNumber,
            customerId: admin.id,
            customerEmail: admin.email,
            status: status as any,
            paymentStatus: 'PAID',
            subtotal,
            shipping,
            tax,
            discount: 0,
            total,
            shippingAddressId: addressId,
            billingAddressId: addressId,
            shippingMethod: 'Free Shipping (Soulmate Perk)',
            trackingNumber: status !== 'PROCESSING' ? '1Z' + faker.string.alphanumeric(16).toUpperCase() : null,
            carrier: status !== 'PROCESSING' ? 'UPS' : null,
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            deliveredAt: status === 'DELIVERED' ? faker.date.recent({ days: 7 }) : null,
            shippedAt: ['DELIVERED', 'SHIPPED'].includes(status) ? faker.date.recent({ days: 10 }) : null,
            createdAt,
          },
        })

        // Create order items
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            productVariantId: variant?.id,
            quantity: 2,
            price: product.price,
            productName: product.name,
            productImage: JSON.parse(product.images as string)[0] || null,
            variantDetails: variant ? `${variant.color} / ${variant.size}` : '',
          },
        })

        // Create points transaction
        const pointsEarned = Math.floor(total * 2 * 10) // 2x multiplier for Soulmate
        await prisma.pointsTransaction.create({
          data: {
            customerId: admin.id,
            orderId: order.id,
            points: pointsEarned,
            type: 'PURCHASE',
            description: `Earned ${pointsEarned} points from order ${orderNumber} (2x Soulmate bonus)`,
          },
        })

        console.log(`   ✅ Order ${orderNumber} - $${total.toFixed(2)} [${status}] (+${pointsEarned} pts)`)
      }

      // Create welcome bonus transaction
      await prisma.pointsTransaction.create({
        data: {
          customerId: admin.id,
          points: 500,
          type: 'ACCOUNT_CREATION',
          description: 'Welcome bonus for joining Care Points program',
        },
      })
      console.log(`   ✅ Welcome bonus: +500 pts`)

      // Create tier upgrade bonus
      await prisma.pointsTransaction.create({
        data: {
          customerId: admin.id,
          points: 1000,
          type: 'PROMOTIONAL',
          description: 'Soulmate tier achievement bonus',
        },
      })
      console.log(`   ✅ Tier bonus: +1000 pts`)
    } else {
      console.log(`   ℹ️ ${existingOrders} orders already exist`)
    }

    // 4. Create wishlist items
    const existingWishlist = await prisma.wishlistItem.count({
      where: { customerId: admin.id },
    })

    if (existingWishlist === 0) {
      const products = await prisma.product.findMany({
        take: 5,
        include: { variants: true },
      })

      for (const product of products.slice(0, 3)) {
        await prisma.wishlistItem.create({
          data: {
            customerId: admin.id,
            productId: product.id,
            productVariantId: product.variants[0]?.id,
            priority: faker.number.int({ min: 0, max: 3 }),
          },
        })
      }
      console.log(`   ✅ Added 3 wishlist items`)
    }

    // 5. Create reviews
    const existingReviews = await prisma.review.count({
      where: { customerId: admin.id },
    })

    if (existingReviews === 0) {
      const products = await prisma.product.findMany({ take: 3 })

      for (const product of products) {
        await prisma.review.create({
          data: {
            productId: product.id,
            customerId: admin.id,
            customerName: admin.name || 'Admin',
            customerEmail: admin.email,
            rating: faker.helpers.arrayElement([4, 5, 5]),
            title: faker.helpers.arrayElement(['Love it!', 'Amazing quality', 'Perfect fit', 'Best purchase ever']),
            comment: faker.lorem.sentences(2),
            isVerified: true,
            status: 'APPROVED',
            helpfulCount: faker.number.int({ min: 5, max: 20 }),
          },
        })
      }
      console.log(`   ✅ Added 3 product reviews`)
    }
  }

  // 6. Verify all table counts
  console.log('\n' + '═'.repeat(60))
  console.log('📊 DATABASE SUMMARY')
  console.log('═'.repeat(60))

  const counts = {
    customers: await prisma.customer.count(),
    loyaltyTiers: await prisma.loyaltyTier.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    products: await prisma.product.count(),
    productVariants: await prisma.productVariant.count(),
    categories: await prisma.category.count(),
    collections: await prisma.collection.count(),
    rewards: await prisma.reward.count(),
    pointsTransactions: await prisma.pointsTransaction.count(),
    reviews: await prisma.review.count(),
    wishlistItems: await prisma.wishlistItem.count(),
    addresses: await prisma.address.count(),
    abandonedCarts: await prisma.abandonedCart.count(),
    expenseCategories: await prisma.expenseCategory.count(),
    expenses: await prisma.expense.count(),
    invoices: await prisma.invoice.count(),
    budgets: await prisma.budget.count(),
    taxRecords: await prisma.taxRecord.count(),
  }

  console.log('\n📦 Core Data:')
  console.log(`   • Customers: ${counts.customers}`)
  console.log(`   • Loyalty Tiers: ${counts.loyaltyTiers}`)
  console.log(`   • Orders: ${counts.orders}`)
  console.log(`   • Order Items: ${counts.orderItems}`)
  console.log(`   • Products: ${counts.products}`)
  console.log(`   • Product Variants: ${counts.productVariants}`)

  console.log('\n🛍️ E-commerce:')
  console.log(`   • Categories: ${counts.categories}`)
  console.log(`   • Collections: ${counts.collections}`)
  console.log(`   • Reviews: ${counts.reviews}`)
  console.log(`   • Wishlist Items: ${counts.wishlistItems}`)
  console.log(`   • Abandoned Carts: ${counts.abandonedCarts}`)
  console.log(`   • Addresses: ${counts.addresses}`)

  console.log('\n💎 Loyalty:')
  console.log(`   • Rewards: ${counts.rewards}`)
  console.log(`   • Points Transactions: ${counts.pointsTransactions}`)

  console.log('\n💰 Financial:')
  console.log(`   • Expense Categories: ${counts.expenseCategories}`)
  console.log(`   • Expenses: ${counts.expenses}`)
  console.log(`   • Invoices: ${counts.invoices}`)
  console.log(`   • Budgets: ${counts.budgets}`)
  console.log(`   • Tax Records: ${counts.taxRecords}`)

  // Show updated admin data
  console.log('\n' + '═'.repeat(60))
  console.log('👤 ADMIN USER DATA')
  console.log('═'.repeat(60))

  const updatedAdmins = await prisma.customer.findMany({
    where: { isAdmin: true },
    include: { loyaltyTier: true },
  })

  for (const admin of updatedAdmins) {
    console.log(`\n   Email: ${admin.email}`)
    console.log(`   Tier: ${admin.loyaltyTier?.name || 'None'} (${admin.loyaltyTier?.slug || 'N/A'})`)
    console.log(`   Points: ${admin.currentPoints.toLocaleString()} current / ${admin.lifetimePoints.toLocaleString()} lifetime`)
    console.log(`   Spent: $${admin.totalSpent.toFixed(2)}`)
    console.log(`   Orders: ${admin.totalOrders}`)
  }

  console.log('\n✅ Admin loyalty data fix complete!')
  console.log('\n🔗 Test at: http://localhost:3000/profile')
  console.log('')
}

fixAdminLoyalty()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
