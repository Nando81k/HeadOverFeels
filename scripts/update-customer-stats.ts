/**
 * Update Customer CRM Statistics
 * 
 * This script calculates and updates CRM tracking fields for all customers:
 * - totalSpent: Sum of all completed order totals
 * - totalOrders: Count of completed orders
 * - lastOrderDate: Most recent order date
 * - avgOrderValue: Average order total
 * 
 * Run after migration: npx tsx scripts/update-customer-stats.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateCustomerStats() {
  console.log('🔄 Updating customer statistics...\n');

  try {
    // Get all customers
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          where: {
            status: {
              in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    console.log(`Found ${customers.length} customers\n`);

    let updatedCount = 0;

    for (const customer of customers) {
      const completedOrders = customer.orders;
      const totalOrders = completedOrders.length;
      const totalSpent = completedOrders.reduce((sum, order) => sum + order.total, 0);
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      const lastOrderDate = completedOrders.length > 0 ? completedOrders[0].createdAt : null;

      // Update customer stats
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalSpent,
          totalOrders,
          lastOrderDate,
          avgOrderValue
        }
      });

      updatedCount++;

      if (totalOrders > 0) {
        console.log(`✅ ${customer.name || customer.email}:`);
        console.log(`   Orders: ${totalOrders}`);
        console.log(`   Total Spent: $${totalSpent.toFixed(2)}`);
        console.log(`   Avg Order: $${avgOrderValue.toFixed(2)}`);
        console.log(`   Last Order: ${lastOrderDate?.toLocaleDateString()}`);
        console.log('');
      }
    }

    console.log(`\n✅ Updated ${updatedCount} customer records`);

  } catch (error) {
    console.error('❌ Error updating customer stats:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateCustomerStats()
  .then(() => {
    console.log('\n✨ Customer statistics update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to update customer statistics:', error);
    process.exit(1);
  });
