import { prisma } from '../lib/prisma';

async function checkDashboardData() {
  console.log('🔍 Checking Dashboard Data...\n');

  try {
    // Get month start date
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total orders
    const totalOrders = await prisma.order.count();
    console.log('📦 Total Orders:', totalOrders);

    // Monthly revenue
    const monthlyRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: monthStart }
      }
    });
    const revenue = monthlyRevenue._sum.total || 0;
    console.log('💰 Revenue (This Month):', `$${revenue.toFixed(2)}`);

    // Active products
    const activeProducts = await prisma.product.count({
      where: { isActive: true }
    });
    console.log('🛍️  Active Products:', activeProducts);

    // Total customers
    const totalCustomers = await prisma.customer.count();
    console.log('👥 Total Customers:', totalCustomers);

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    console.log('\n📋 Recent Orders:');
    if (recentOrders.length === 0) {
      console.log('   No orders yet');
    } else {
      recentOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. Order #${order.orderNumber}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Customer: ${order.customer?.name || 'Guest'} (${order.customer?.email || 'N/A'})`);
        console.log(`      Total: $${order.total.toFixed(2)}`);
        console.log(`      Date: ${order.createdAt.toLocaleDateString()}`);
        console.log('');
      });
    }

    console.log('✅ Dashboard data check complete!\n');
  } catch (error) {
    console.error('❌ Error checking dashboard data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDashboardData();
