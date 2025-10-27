import { prisma } from '../lib/prisma';

async function seedTestProducts() {
  console.log('🌱 Seeding test products...\n');

  try {
    // 1. Activate existing product
    const existingProduct = await prisma.product.findFirst({
      where: { name: 'Ribbed Beanie' }
    });

    if (existingProduct) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: { isActive: true }
      });
      console.log('✅ Activated: Ribbed Beanie');
    }

    // 2. Create a few more streetwear products
    const products = [
      {
        name: 'Oversized Graphic Hoodie',
        slug: 'oversized-graphic-hoodie',
        description: 'Premium heavyweight hoodie with exclusive graphic print. Limited edition streetwear staple.',
        price: 89.99,
        compareAtPrice: 120.00,
        isActive: true,
        images: JSON.stringify(['/placeholder-product.jpg']),
      },
      {
        name: 'Cargo Joggers - Black',
        slug: 'cargo-joggers-black',
        description: 'Technical cargo joggers with multiple pockets. Perfect for street style.',
        price: 74.99,
        compareAtPrice: 95.00,
        isActive: true,
        images: JSON.stringify(['/placeholder-product.jpg']),
      },
      {
        name: 'Classic Logo Tee',
        slug: 'classic-logo-tee',
        description: 'Premium cotton tee with embroidered logo. Essential streetwear piece.',
        price: 37.00,
        compareAtPrice: 45.00,
        isActive: true,
        images: JSON.stringify(['/placeholder-product.jpg']),
      },
      {
        name: 'Bucket Hat - Cream',
        slug: 'bucket-hat-cream',
        description: 'Reversible bucket hat with embroidered branding. Streetwear essential.',
        price: 42.00,
        compareAtPrice: 55.00,
        isActive: true,
        images: JSON.stringify(['/placeholder-product.jpg']),
      },
    ];

    for (const productData of products) {
      // Check if product already exists
      const existing = await prisma.product.findUnique({
        where: { slug: productData.slug }
      });

      if (!existing) {
        await prisma.product.create({
          data: productData
        });
        console.log(`✅ Created: ${productData.name}`);
      } else {
        console.log(`⏭️  Skipped: ${productData.name} (already exists)`);
      }
    }

    // Show final count
    const activeCount = await prisma.product.count({ where: { isActive: true } });
    const totalCount = await prisma.product.count();

    console.log('\n📊 Products Summary:');
    console.log(`   Active: ${activeCount}`);
    console.log(`   Total: ${totalCount}`);
    console.log('\n✅ Seeding complete!\n');

  } catch (error) {
    console.error('❌ Error seeding products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestProducts();
