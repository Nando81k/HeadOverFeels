import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Get all limited edition products (drops)
    const drops = await prisma.product.findMany({
      where: {
        isLimitedEdition: true,
        releaseDate: {
          gte: startDate,
        },
      },
      include: {
        variants: true,
        orderItems: {
          include: {
            order: {
              select: {
                id: true,
                customerId: true,
                total: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        releaseDate: 'desc',
      },
    });

    // Get drop notifications for waitlist data
    const dropNotifications = await prisma.dropNotification.groupBy({
      by: ['productId'],
      _count: {
        email: true,
      },
    });

    const notificationMap = new Map(
      dropNotifications.map(n => [n.productId, n._count.email])
    );

    // Calculate analytics for each drop
    const analytics = await Promise.all(
      drops.map(async (drop) => {
        // Calculate total inventory
        const totalInventory = drop.maxQuantity || 
          drop.variants.reduce((sum, v) => sum + v.inventory, 0);

        // Get valid orders (not cancelled)
        const validOrders = drop.orderItems
          .filter(item => 
            item.order.status !== 'CANCELLED' && 
            item.order.status !== 'REFUNDED'
          )
          .map(item => item.order);

        // Calculate units sold
        const unitsSold = drop.orderItems
          .filter(item => 
            item.order.status !== 'CANCELLED' && 
            item.order.status !== 'REFUNDED'
          )
          .reduce((sum, item) => sum + item.quantity, 0);

        // Calculate revenue
        const revenue = validOrders.reduce((sum, order) => sum + order.total, 0);

        // Calculate unique customers
        const uniqueCustomers = new Set(
          validOrders
            .filter(o => o.customerId)
            .map(o => o.customerId)
        ).size;

        // Calculate sell-through rate
        const sellThroughRate = totalInventory > 0 
          ? (unitsSold / totalInventory) * 100 
          : 0;

        // Calculate time to sell out
        let timeToSellOut: number | null = null;
        if (sellThroughRate >= 100 && drop.releaseDate) {
          const soldOutOrder = drop.orderItems
            .filter(item => 
              item.order.status !== 'CANCELLED' && 
              item.order.status !== 'REFUNDED'
            )
            .sort((a, b) => 
              new Date(b.order.createdAt).getTime() - 
              new Date(a.order.createdAt).getTime()
            )[0];

          if (soldOutOrder) {
            const releaseTime = new Date(drop.releaseDate).getTime();
            const soldOutTime = new Date(soldOutOrder.order.createdAt).getTime();
            timeToSellOut = (soldOutTime - releaseTime) / (1000 * 60); // minutes
          }
        }

        // Calculate hours live
        const releaseTime = drop.releaseDate ? new Date(drop.releaseDate).getTime() : now.getTime();
        const endTime = drop.dropEndDate ? 
          Math.min(new Date(drop.dropEndDate).getTime(), now.getTime()) : 
          now.getTime();
        const hoursLive = (endTime - releaseTime) / (1000 * 60 * 60);

        // Get waitlist signups
        const waitlistSignups = notificationMap.get(drop.id) || 0;

        // Calculate waitlist conversion
        const waitlistConversionRate = waitlistSignups > 0 
          ? (uniqueCustomers / waitlistSignups) * 100 
          : 0;

        // Calculate average order value and units per order
        const orderCount = validOrders.length;
        const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;
        const unitsPerOrder = orderCount > 0 ? unitsSold / orderCount : 0;

        // Determine status
        let status: 'past' | 'live' | 'upcoming' = 'past';
        if (drop.releaseDate && drop.dropEndDate) {
          const releaseDate = new Date(drop.releaseDate);
          const dropEndDate = new Date(drop.dropEndDate);
          
          if (now < releaseDate) {
            status = 'upcoming';
          } else if (now >= releaseDate && now <= dropEndDate) {
            status = 'live';
          }
        }

        return {
          dropId: drop.id,
          dropName: drop.name,
          releaseDate: drop.releaseDate,
          dropEndDate: drop.dropEndDate,
          status,
          
          // Sales metrics
          totalInventory,
          unitsSold,
          sellThroughRate,
          revenue,
          
          // Time metrics
          timeToSellOut,
          hoursLive,
          
          // Customer metrics
          uniqueCustomers,
          waitlistSignups,
          waitlistConversionRate,
          
          // Performance indicators
          averageOrderValue,
          unitsPerOrder,
        };
      })
    );

    return NextResponse.json({
      drops: analytics,
      count: analytics.length,
    });
  } catch (error) {
    console.error('Error fetching drop analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drop analytics' },
      { status: 500 }
    );
  }
}
