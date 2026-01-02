import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth/admin';

// GET /api/admin/sales/recent - Get recent sales for live feed
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request);
    if (!adminId) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Fetch recent orders with customer info
    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          select: {
            quantity: true,
          },
        },
      },
    });

    // Transform data for frontend
    const sales = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer?.name || 'Guest',
      total: order.total,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt,
      status: order.status,
    }));

    return NextResponse.json({
      sales,
      count: sales.length,
    });
  } catch (error) {
    console.error('Error fetching recent sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent sales' },
      { status: 500 }
    );
  }
}
