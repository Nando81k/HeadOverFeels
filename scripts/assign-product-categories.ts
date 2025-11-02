import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignCategories() {
  const categories = await prisma.category.findMany()
  const catMap: Record<string, string> = {}
  categories.forEach(c => catMap[c.slug] = c.id)
  
  // Product to category mapping
  const updates = [
    { name: 'Ribbed Beanie', categorySlug: 'headwear' },
    { name: 'Oversized Graphic Hoodie', categorySlug: 'tops' },
    { name: 'Cargo Joggers - Black', categorySlug: 'bottoms' },
    { name: 'Classic Logo Tee', categorySlug: 'tops' },
    { name: 'Bucket Hat - Cream', categorySlug: 'headwear' },
    { name: "Eva's Purple Flame", categorySlug: 'tops' },
  ]
  
  console.log('🏷️  Assigning categories to products...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  for (const update of updates) {
    try {
      const product = await prisma.product.findFirst({
        where: { name: { contains: update.name } }
      })
      
      if (product && !product.categoryId) {
        await prisma.product.update({
          where: { id: product.id },
          data: { categoryId: catMap[update.categorySlug] }
        })
        console.log(`✓ ${update.name} → ${update.categorySlug}`)
      } else if (product?.categoryId) {
        console.log(`⊘ ${update.name} (already has category)`)
      } else {
        console.log(`⚠ ${update.name} (not found)`)
      }
    } catch (error) {
      console.error(`✗ ${update.name}:`, error)
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Category assignment complete!')
  
  await prisma.$disconnect()
}

assignCategories()
  .catch((error) => {
    console.error('Error assigning categories:', error)
    process.exit(1)
  })
