import { prisma } from '../lib/prisma';

async function createLowStockVariants() {
  console.log('📦 Creating low stock product variants...\n');

  try {
    // Get existing products
    const products = await prisma.product.findMany({
      where: { isActive: true },
      take: 3,
    });

    if (products.length === 0) {
      console.log('❌ No products found. Run seed-test-products.ts first.');
      return;
    }

    let createdCount = 0;

    for (const product of products) {
      // Create some low stock variants
      const variants = [
        { size: 'S', color: 'Black', inventory: 2, sku: `${product.slug}-S-BLK` },
        { size: 'M', color: 'Black', inventory: 4, sku: `${product.slug}-M-BLK` },
        { size: 'L', color: 'White', inventory: 1, sku: `${product.slug}-L-WHT` },
        { size: 'XL', color: 'White', inventory: 3, sku: `${product.slug}-XL-WHT` },
      ];

      for (const variantData of variants) {
        // Check if variant already exists
        const existing = await prisma.productVariant.findUnique({
          where: { sku: variantData.sku }
        });

        if (!existing) {
          await prisma.productVariant.create({
            data: {
              ...variantData,
              productId: product.id,
            }
          });
          createdCount++;
          console.log(`✅ Created: ${product.name} - ${variantData.size} ${variantData.color} (${variantData.inventory} units)`);
        } else {
          console.log(`⏭️  Skipped: ${product.name} - ${variantData.size} ${variantData.color} (already exists)`);
        }
      }
    }

    // Show summary
    const lowStockCount = await prisma.productVariant.count({
      where: { inventory: { lt: 5 } }
    });

    const totalVariants = await prisma.productVariant.count();

    console.log('\n📊 Variants Summary:');
    console.log(`   Low Stock (< 5): ${lowStockCount}`);
    console.log(`   Total Variants: ${totalVariants}`);
    console.log(`\n✅ Created ${createdCount} new variants!\n`);

  } catch (error) {
    console.error('❌ Error creating variants:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createLowStockVariants();
