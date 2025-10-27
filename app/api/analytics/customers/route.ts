/**
 * Customer Analytics API
 * 
 * GET /api/analytics/customers
 * Returns customer acquisition trends and metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  getDateRange,
  getPreviousPeriod,
  calculateGrowthRate,
  aggregateCustomerAcquisition
} from '@/lib/analytics/calculations';
import type { CustomerAnalytics, AnalyticsResponse, CustomerMetrics, SegmentDistribution } from '@/lib/analytics/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') as '7d' | '30d' | '90d' | 'custom' || '30d';
    const customStart = searchParams.get('customStartDate');
    const customEnd = searchParams.get('customEndDate');
    const granularity = searchParams.get('granularity') as 'daily' | 'weekly' | 'monthly' || 'daily';
    const compareWithPrevious = searchParams.get('compareWithPrevious') === 'true';

    // Get date ranges
    const currentRange = getDateRange(
      period, 
      customStart ? new Date(customStart) : undefined,
      customEnd ? new Date(customEnd) : undefined
    );
    
    const previousRange = compareWithPrevious ? getPreviousPeriod(currentRange) : null;

    // Fetch current period customers
    const currentCustomers = await prisma.customer.findMany({
      where: {
        createdAt: {
          gte: currentRange.startDate,
          lte: currentRange.endDate
        }
      },
      include: {
        orders: {
          where: {
            status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
          }
        }
      }
    });

    // Fetch previous period customers
    const previousCustomers = previousRange ? await prisma.customer.findMany({
      where: {
        createdAt: {
          gte: previousRange.startDate,
          lte: previousRange.endDate
        }
      },
      include: {
        orders: {
          where: {
            status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
          }
        }
      }
    }) : [];

    // Calculate current period metrics
    const totalCustomers = currentCustomers.length;
    const repeatCustomers = currentCustomers.filter(c => (c.orders?.length || 0) > 1).length;
    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    
    // Calculate LTV from orders (fallback if totalSpent not available)
    const totalSpent = currentCustomers.reduce((sum, c) => {
      const customerTotal = c.orders?.reduce((orderSum, o) => orderSum + o.total, 0) || 0;
      return sum + customerTotal;
    }, 0);
    const averageLifetimeValue = currentCustomers.length > 0 ? totalSpent / currentCustomers.length : 0;

    const currentMetrics: CustomerMetrics = {
      totalCustomers,
      newCustomers: totalCustomers, // All are new in the current period
      repeatCustomerRate,
      averageLifetimeValue
    };

    // Calculate previous period metrics
    const previousTotal = previousCustomers.length;
    const previousRepeat = previousCustomers.filter(c => (c.orders?.length || 0) > 1).length;
    const previousRepeatRate = previousTotal > 0 ? (previousRepeat / previousTotal) * 100 : 0;
    
    // Calculate previous LTV from orders
    const previousTotalSpent = previousCustomers.reduce((sum, c) => {
      const customerTotal = c.orders?.reduce((orderSum, o) => orderSum + o.total, 0) || 0;
      return sum + customerTotal;
    }, 0);
    const previousLTV = previousCustomers.length > 0 ? previousTotalSpent / previousCustomers.length : 0;

    const previousMetrics: CustomerMetrics = {
      totalCustomers: previousTotal,
      newCustomers: previousTotal,
      repeatCustomerRate: previousRepeatRate,
      averageLifetimeValue: previousLTV
    };

    // Calculate growth rate
    const growthRate = calculateGrowthRate(currentMetrics.totalCustomers, previousMetrics.totalCustomers);

    // Aggregate customer acquisition over time
    const acquisitionOverTime = aggregateCustomerAcquisition(
      currentCustomers,
      currentRange,
      granularity
    );

    // Calculate segment distribution
    // Note: Using email domain as temporary segment since Customer model might not have segment field yet
    const segmentMap = new Map<string, number>();
    currentCustomers.forEach(customer => {
      const domain = customer.email.split('@')[1] || 'unknown';
      const segment = domain.includes('gmail') ? 'Personal' : 
                     domain.includes('company') ? 'Business' : 'Other';
      segmentMap.set(segment, (segmentMap.get(segment) || 0) + 1);
    });

    const segmentDistribution: SegmentDistribution[] = Array.from(segmentMap.entries())
      .map(([segment, count]) => ({
        segment,
        count,
        percentage: totalCustomers > 0 ? (count / totalCustomers) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Build response
    const analytics: CustomerAnalytics = {
      current: currentMetrics,
      previous: previousMetrics,
      growthRate,
      acquisitionOverTime,
      segmentDistribution
    };

    const response: AnalyticsResponse<CustomerAnalytics> = {
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
    console.error('Customer analytics error:', error);
    
    const response: AnalyticsResponse<CustomerAnalytics> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate customer analytics'
    };

    return NextResponse.json(response, { status: 500 });
  }
}
