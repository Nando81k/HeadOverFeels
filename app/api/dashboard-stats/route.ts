import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Helper function
    function getMonthStart(): Date {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    // Fetch current month stats (most commonly used)
    const [monthOrders, monthRevenue, activeProducts, totalCustomers, pendingOrdersCount] = await Promise.all([
      prisma.order.count({
        where: { createdAt: { gte: getMonthStart() } }
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'CANCELLED' },
          createdAt: { gte: getMonthStart() }
        }
      }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        orders: monthOrders,
        revenue: monthRevenue._sum.total || 0,
        products: activeProducts,
        customers: totalCustomers,
        pendingOrders: pendingOrdersCount,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
