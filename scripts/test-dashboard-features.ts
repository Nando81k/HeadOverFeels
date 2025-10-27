import { prisma } from '../lib/prisma';

async function testDashboardFeatures() {
  console.log('🧪 Testing Dashboard Features...\n');

  try {
    // Helper functions
    const getTodayStart = () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    };

    const getWeekStart = () => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day;
      return new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    };

    const getMonthStart = () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    };

    const getYearStart = () => {
      const now = new Date();
      return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    };

    console.log('📊 Feature 1: Time Period Stats');
    console.log('================================\n');

    // Today
    const todayOrders = await prisma.order.count({
      where: { createdAt: { gte: getTodayStart() } }
    });
    const todayRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getTodayStart() }
      }
    });

    console.log('Today:');
    console.log(`  Orders: ${todayOrders}`);
    console.log(`  Revenue: $${(todayRevenue._sum.total || 0).toFixed(2)}\n`);

    // This Week
    const weekOrders = await prisma.order.count({
      where: { createdAt: { gte: getWeekStart() } }
    });
    const weekRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getWeekStart() }
      }
    });

    console.log('This Week:');
    console.log(`  Orders: ${weekOrders}`);
    console.log(`  Revenue: $${(weekRevenue._sum.total || 0).toFixed(2)}\n`);

    // This Month
    const monthOrders = await prisma.order.count({
      where: { createdAt: { gte: getMonthStart() } }
    });
    const monthRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getMonthStart() }
      }
    });

    console.log('This Month:');
    console.log(`  Orders: ${monthOrders}`);
    console.log(`  Revenue: $${(monthRevenue._sum.total || 0).toFixed(2)}\n`);

    // This Year
    const yearOrders = await prisma.order.count({
      where: { createdAt: { gte: getYearStart() } }
    });
    const yearRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getYearStart() }
      }
    });

    console.log('This Year:');
    console.log(`  Orders: ${yearOrders}`);
    console.log(`  Revenue: $${(yearRevenue._sum.total || 0).toFixed(2)}\n`);

    console.log('📈 Feature 2: Revenue Trend Indicators');
    console.log('======================================\n');

    const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59);

    const lastMonthRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd }
      }
    });

    const currentRev = monthRevenue._sum.total || 0;
    const previousRev = lastMonthRevenue._sum.total || 0;
    const change = previousRev > 0 ? ((currentRev - previousRev) / previousRev) * 100 : 0;
    const trend = change >= 0 ? '↑' : '↓';

    console.log('This Month vs Last Month:');
    console.log(`  Current: $${currentRev.toFixed(2)}`);
    console.log(`  Previous: $${previousRev.toFixed(2)}`);
    console.log(`  Change: ${trend} ${Math.abs(change).toFixed(1)}%\n`);

    console.log('⚠️  Feature 3: Low Stock Alerts');
    console.log('================================\n');

    const LOW_STOCK_THRESHOLD = 5;
    const lowStockProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        variants: {
          some: {
            inventory: { lt: LOW_STOCK_THRESHOLD }
          }
        }
      },
      include: {
        variants: {
          where: {
            inventory: { lt: LOW_STOCK_THRESHOLD }
          },
          select: {
            id: true,
            size: true,
            color: true,
            inventory: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`Found ${lowStockProducts.length} products with low stock:\n`);
    lowStockProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      product.variants.forEach(variant => {
        console.log(`   - ${variant.size || 'N/A'} ${variant.color || 'N/A'}: ${variant.inventory} units`);
      });
      console.log('');
    });

    console.log('🔔 Feature 4: Pending Orders Badge');
    console.log('==================================\n');

    const pendingOrders = await prisma.order.findMany({
      where: { status: 'PENDING' },
      include: {
        customer: {
          select: { name: true, email: true }
        }
      }
    });

    console.log(`Pending Orders: ${pendingOrders.length}\n`);
    if (pendingOrders.length > 0) {
      pendingOrders.forEach((order, index) => {
        console.log(`${index + 1}. Order #${order.orderNumber}`);
        console.log(`   Customer: ${order.customer?.name || 'Guest'}`);
        console.log(`   Total: $${order.total.toFixed(2)}`);
        console.log('');
      });
    } else {
      console.log('   No pending orders at the moment.\n');
    }

    console.log('✅ All features tested successfully!\n');

  } catch (error) {
    console.error('❌ Error testing features:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboardFeatures();
