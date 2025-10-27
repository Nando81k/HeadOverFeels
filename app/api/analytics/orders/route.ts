/**
 * Order Analytics API
 * 
 * GET /api/analytics/orders
 * Returns order metrics, status distribution, and trends over time
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  getDateRange,
  getPreviousPeriod,
  calculateGrowthRate,
  getOrderStatusDistribution,
  COMPLETED_ORDER_STATUSES
} from '@/lib/analytics/calculations';
import { format, eachDayOfInterval, differenceInHours } from 'date-fns';
import type { OrderAnalytics, AnalyticsResponse, OrderMetrics, OrdersOverTime } from '@/lib/analytics/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') as '7d' | '30d' | '90d' | 'custom' || '30d';
    const customStart = searchParams.get('customStartDate');
    const customEnd = searchParams.get('customEndDate');
    const compareWithPrevious = searchParams.get('compareWithPrevious') === 'true';

    // Get date ranges
    const currentRange = getDateRange(
      period, 
      customStart ? new Date(customStart) : undefined,
      customEnd ? new Date(customEnd) : undefined
    );
    
    const previousRange = compareWithPrevious ? getPreviousPeriod(currentRange) : null;

    // Fetch current period orders
    const currentOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: currentRange.startDate,
          lte: currentRange.endDate
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Fetch previous period orders
    const previousOrders = previousRange ? await prisma.order.findMany({
      where: {
        createdAt: {
          gte: previousRange.startDate,
          lte: previousRange.endDate
        }
      }
    }) : [];

    // Calculate current period metrics
    const totalOrders = currentOrders.length;
    const completedOrders = currentOrders.filter(o => 
      COMPLETED_ORDER_STATUSES.includes(o.status as typeof COMPLETED_ORDER_STATUSES[number])
    );
    
    // Calculate average fulfillment time (hours from creation to delivery/shipment)
    const ordersWithFulfillment = currentOrders.filter(o => 
      o.shippedAt || o.deliveredAt
    );
    const avgFulfillmentTime = ordersWithFulfillment.length > 0
      ? ordersWithFulfillment.reduce((sum, o) => {
          const fulfillmentDate = o.deliveredAt || o.shippedAt || o.createdAt;
          return sum + differenceInHours(fulfillmentDate, o.createdAt);
        }, 0) / ordersWithFulfillment.length
      : 0;

    const completionRate = totalOrders > 0 
      ? (completedOrders.length / totalOrders) * 100 
      : 0;

    const currentMetrics: OrderMetrics = {
      totalOrders,
      averageFulfillmentTime: Math.round(avgFulfillmentTime),
      completionRate: Math.round(completionRate * 10) / 10 // Round to 1 decimal
    };

    // Calculate previous period metrics
    const previousTotal = previousOrders.length;
    const previousCompleted = previousOrders.filter(o => 
      COMPLETED_ORDER_STATUSES.includes(o.status as typeof COMPLETED_ORDER_STATUSES[number])
    );
    const previousCompletionRate = previousTotal > 0
      ? (previousCompleted.length / previousTotal) * 100
      : 0;

    const previousMetrics: OrderMetrics = {
      totalOrders: previousTotal,
      averageFulfillmentTime: 0, // Would need to fetch full order data
      completionRate: Math.round(previousCompletionRate * 10) / 10
    };

    // Calculate growth rate
    const growthRate = calculateGrowthRate(currentMetrics.totalOrders, previousMetrics.totalOrders);

    // Aggregate orders over time
    const intervals = eachDayOfInterval({ start: currentRange.startDate, end: currentRange.endDate });
    const ordersOverTime: OrdersOverTime[] = intervals.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOrders = currentOrders.filter(o => {
        const orderDate = format(new Date(o.createdAt), 'yyyy-MM-dd');
        return orderDate === dateStr;
      });

      return {
        date: dateStr,
        count: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + o.total, 0)
      };
    });

    // Get status distribution
    const statusDistribution = getOrderStatusDistribution(currentOrders);

    // Build response
    const analytics: OrderAnalytics = {
      current: currentMetrics,
      previous: previousMetrics,
      growthRate,
      ordersOverTime,
      statusDistribution
    };

    const response: AnalyticsResponse<OrderAnalytics> = {
      success: true,
      data: analytics,
      metadata: {
        dateRange: currentRange,
        comparisonPeriod: previousRange || undefined,
        generatedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Order analytics error:', error);
    
    const response: AnalyticsResponse<OrderAnalytics> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate order analytics'
    };

    return NextResponse.json(response, { status: 500 });
  }
}
