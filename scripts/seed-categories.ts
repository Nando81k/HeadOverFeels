import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  {
    name: 'Tops',
    slug: 'tops',
    description: 'T-shirts, hoodies, sweaters, and more',
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Bottoms',
    slug: 'bottoms',
    description: 'Pants, joggers, shorts, and more',
    isActive: true,
    sortOrder: 2,
  },
  {
    name: 'Outerwear',
    slug: 'outerwear',
    description: 'Jackets, coats, and outer layers',
    isActive: true,
    sortOrder: 3,
  },
  {
    name: 'Headwear',
    slug: 'headwear',
    description: 'Hats, beanies, caps, and more',
    isActive: true,
    sortOrder: 4,
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Bags, jewelry, and other accessories',
    isActive: true,
    sortOrder: 5,
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    description: 'Shoes, sneakers, and boots',
    isActive: true,
    sortOrder: 6,
  },
]

async function seedCategories() {
  console.log('🌱 Starting category seeding...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  for (const category of categories) {
    try {
      const existing = await prisma.category.findUnique({
        where: { slug: category.slug },
      })

      if (existing) {
        console.log(`⊘ ${category.name} (already exists)`)
      } else {
        await prisma.category.create({
          data: category,
        })
        console.log(`✓ ${category.name}`)
      }
    } catch (error) {
      console.error(`✗ ${category.name}:`, error)
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Category seeding complete!')

  // Show final count
  const count = await prisma.category.count()
  console.log(`\n📊 Total categories: ${count}`)

  await prisma.$disconnect()
}

seedCategories()
  .catch((error) => {
    console.error('Error seeding categories:', error)
    process.exit(1)
  })
