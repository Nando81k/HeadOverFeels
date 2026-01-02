import { prisma } from '../lib/prisma'

async function markBestSellers() {
  // Find 2 new products to mark as featured (best sellers)
  const productsToFeature = ['Tokyo Nights Hoodie', 'Varsity Letterman Jacket']
  
  for (const name of productsToFeature) {
    const product = await prisma.product.findFirst({
      where: { name }
    })
    
    if (product) {
      await prisma.product.update({
        where: { id: product.id },
        data: { isFeatured: true }
      })
      console.log('✅ Marked as Best Seller:', name)
    } else {
      console.log('⚠️ Product not found:', name)
    }
  }
  
  // Show all featured products
  const featured = await prisma.product.findMany({
    where: { isFeatured: true },
    select: { name: true }
  })
  console.log('\n🌟 All Best Sellers:', featured.map(p => p.name))
}

markBestSellers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
