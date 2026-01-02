import { prisma } from '../lib/prisma'

// Placeholder image for products without images
const PLACEHOLDER_IMAGE = '/assets/coming-soon-placeholder.svg'

// Collection definitions
const COLLECTIONS = [
  {
    name: 'New Arrivals',
    slug: 'new-arrivals',
    description: 'Fresh drops just landed. Be the first to cop.',
    isFeatured: true,
  },
  {
    name: 'Street Essentials',
    slug: 'street-essentials',
    description: 'Core pieces every streetwear wardrobe needs.',
    isFeatured: true,
  },
  {
    name: 'Premium Collection',
    slug: 'premium-collection',
    description: 'Elevated streetwear for the discerning taste.',
    isFeatured: false,
  },
  {
    name: 'Bold Statements',
    slug: 'bold-statements',
    description: 'Stand out pieces that turn heads.',
    isFeatured: true,
  },
  {
    name: 'Comfort Zone',
    slug: 'comfort-zone',
    description: 'Cozy fits for laid-back days.',
    isFeatured: false,
  },
]

async function main() {
  console.log('🔍 Checking current state...\n')
  
  // Get all products
  const products = await prisma.product.findMany({
    select: { id: true, name: true, images: true },
    orderBy: { createdAt: 'desc' }
  })
  console.log(`Total products: ${products.length}`)
  
  // Find products without images
  const productsWithoutImages = products.filter(p => !p.images || p.images === '[]' || p.images === '')
  console.log(`Products without images: ${productsWithoutImages.length}`)
  
  // Update products without images to have placeholder
  if (productsWithoutImages.length > 0) {
    console.log('\n📷 Adding placeholder images...')
    for (const product of productsWithoutImages) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images: JSON.stringify([PLACEHOLDER_IMAGE]) }
      })
      console.log(`  ✅ ${product.name}`)
    }
  }
  
  // Create collections
  console.log('\n📦 Creating collections...')
  const createdCollections = []
  
  for (const collection of COLLECTIONS) {
    const created = await prisma.collection.upsert({
      where: { slug: collection.slug },
      update: {
        name: collection.name,
        description: collection.description,
        isFeatured: collection.isFeatured,
      },
      create: collection
    })
    createdCollections.push(created)
    console.log(`  ✅ ${created.name}`)
  }
  
  // Distribute products evenly across collections
  console.log('\n🔗 Distributing products across collections...')
  
  // Get fresh product list
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' }
  })
  
  const productsPerCollection = Math.ceil(allProducts.length / COLLECTIONS.length)
  
  // Clear existing collection products
  await prisma.collectionProduct.deleteMany({})
  
  for (let i = 0; i < createdCollections.length; i++) {
    const collection = createdCollections[i]
    const startIdx = i * productsPerCollection
    const endIdx = Math.min(startIdx + productsPerCollection, allProducts.length)
    const collectionProducts = allProducts.slice(startIdx, endIdx)
    
    for (let j = 0; j < collectionProducts.length; j++) {
      const product = collectionProducts[j]
      await prisma.collectionProduct.create({
        data: {
          collectionId: collection.id,
          productId: product.id,
          sortOrder: j
        }
      })
    }
    
    console.log(`  📁 ${collection.name}: ${collectionProducts.length} products`)
  }
  
  // Summary
  console.log('\n✨ Done!')
  console.log(`   Collections created: ${createdCollections.length}`)
  console.log(`   Products with placeholder images: ${productsWithoutImages.length}`)
  console.log(`   Products distributed: ${allProducts.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
