import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addCostPrices() {
  console.log('Adding cost prices to products...\n');

  try {
    // Get all products
    const products = await prisma.product.findMany({
      include: {
        variants: true,
      },
    });

    console.log(`Found ${products.length} products\n`);

    for (const product of products) {
      // Calculate a realistic cost price (typically 30-60% of selling price for retail)
      // Using 40-50% as a reasonable wholesale cost
      const costMultiplier = 0.40 + Math.random() * 0.10; // Random between 40-50%
      const costPrice = Math.round(product.price * costMultiplier * 100) / 100;

      // Update product cost price
      await prisma.product.update({
        where: { id: product.id },
        data: { costPrice },
      });

      console.log(`✓ ${product.name}`);
      console.log(`  Price: $${product.price} → Cost: $${costPrice} (${Math.round((1 - costMultiplier) * 100)}% margin)`);

      // Update variants if they exist
      if (product.variants.length > 0) {
        for (const variant of product.variants) {
          // Variants might have slightly different costs due to materials/sizes
          const variantCostMultiplier = 0.38 + Math.random() * 0.14; // Random between 38-52%
          // Use variant price if available, otherwise fall back to product price
          const variantPrice = variant.price ?? product.price;
          const variantCostPrice = Math.round(variantPrice * variantCostMultiplier * 100) / 100;

          await prisma.productVariant.update({
            where: { id: variant.id },
            data: { costPrice: variantCostPrice },
          });

          console.log(`  ↳ Variant: ${variant.sku} - Price: $${variantPrice} → Cost: $${variantCostPrice}`);
        }
      }

      console.log('');
    }

    console.log('✅ Cost prices added successfully!');
    console.log('\nNote: These are sample cost prices for demonstration.');
    console.log('In production, you would import actual cost data from your supplier/accounting system.\n');

  } catch (error) {
    console.error('Error adding cost prices:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addCostPrices();
