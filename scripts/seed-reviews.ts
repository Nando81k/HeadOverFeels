import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Sample reviews with varied ratings and comments
const reviewTemplates = [
  {
    rating: 5,
    title: "Absolutely love it!",
    comment: "This is hands down one of the best purchases I've made. The quality is incredible and it fits perfectly. Already planning to order more colors!"
  },
  {
    rating: 5,
    title: "Perfect addition to my wardrobe",
    comment: "The material is so soft and comfortable. I've worn this multiple times already and it still looks brand new after washing. Highly recommend!"
  },
  {
    rating: 4,
    title: "Great quality, runs slightly large",
    comment: "Really happy with this purchase! The quality exceeded my expectations. Only giving 4 stars because it runs a bit large - I'd recommend sizing down if you're between sizes."
  },
  {
    rating: 5,
    title: "My new favorite piece",
    comment: "I get so many compliments every time I wear this. The design is unique and the craftsmanship is top-notch. Will definitely be shopping here again!"
  },
  {
    rating: 4,
    title: "Solid purchase",
    comment: "Good quality streetwear at a fair price. Shipping was fast and the packaging was nice. The only reason for 4 stars is I wish there were more color options."
  },
  {
    rating: 5,
    title: "Exceeded expectations!",
    comment: "I was hesitant to order online but this exceeded all my expectations. True to the photos, amazing quality, and the fit is perfect. 10/10 would recommend!"
  }
]

async function seedReviews() {
  console.log('🌱 Seeding reviews...\n')

  // Get 3 customers with names
  const customers = await prisma.customer.findMany({
    where: {
      name: { not: null }
    },
    take: 3
  })

  if (customers.length < 3) {
    // If not enough customers with names, get any customers
    const moreCustomers = await prisma.customer.findMany({
      take: 3 - customers.length,
      where: {
        id: { notIn: customers.map(c => c.id) }
      }
    })
    customers.push(...moreCustomers)
  }

  console.log(`Found ${customers.length} customers:`)
  customers.forEach(c => console.log(`  - ${c.name || c.email}`))

  // Get all active products
  const products = await prisma.product.findMany({
    where: { isActive: true }
  })

  console.log(`\nFound ${products.length} active products:`)
  products.forEach(p => console.log(`  - ${p.name}`))

  // Create reviews
  let reviewIndex = 0
  const createdReviews: { customerName: string; productName: string; rating: number }[] = []

  for (const customer of customers) {
    for (const product of products) {
      const template = reviewTemplates[reviewIndex % reviewTemplates.length]
      const customerName = customer.name || customer.email.split('@')[0]

      // Check if review already exists
      const existingReview = await prisma.review.findFirst({
        where: {
          customerId: customer.id,
          productId: product.id
        }
      })

      if (existingReview) {
        console.log(`  ⏭️  Review already exists for ${customerName} on ${product.name}`)
        continue
      }

      await prisma.review.create({
        data: {
          productId: product.id,
          customerId: customer.id,
          rating: template.rating,
          title: template.title,
          comment: template.comment,
          customerName: customerName,
          customerEmail: customer.email,
          status: 'APPROVED', // Auto-approve for demo
          isVerified: true, // Mark as verified purchase
          helpfulCount: Math.floor(Math.random() * 15),
          notHelpfulCount: Math.floor(Math.random() * 3),
        }
      })

      createdReviews.push({
        customerName,
        productName: product.name,
        rating: template.rating
      })

      reviewIndex++
    }
  }

  console.log(`\n✅ Created ${createdReviews.length} reviews:`)
  createdReviews.forEach(r => {
    console.log(`  ⭐ ${r.rating}/5 - ${r.customerName} reviewed "${r.productName}"`)
  })

  await prisma.$disconnect()
  console.log('\n🎉 Done!')
}

seedReviews().catch(console.error)
