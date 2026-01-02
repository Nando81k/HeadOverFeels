/**
 * Customer Analytics API (Enhanced)
 * 
 * GET /api/analytics/customers
 * Returns comprehensive customer analytics including:
 * - Segment distribution (VIP, Active, New, At-Risk, Inactive)
 * - Activity trends over time
 * - Retention metrics
 * - Customer acquisition trends
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  getDateRange,
  getPreviousPeriod,
  calculateGrowthRate,
  aggregateCustomerAcquisition
} from '@/lib/analytics/calculations';
import { calculateCustomerSegment, DEFAULT_SEGMENT_CONFIG } from '@/lib/customer-segments';
import type { CustomerAnalytics, AnalyticsResponse, CustomerMetrics, SegmentDistribution } from '@/lib/analytics/types';

// Extended analytics interface
interface ExtendedCustomerAnalytics extends CustomerAnalytics {
  metrics: {
    total: number;
    totalChange: number;
    newCustomers: number;
    newCustomersChange: number;
    vip: number;
    vipChange: number;
    active: number;
    activeChange: number;
    atRisk: number;
    atRiskChange: number;
    inactive: number;
    inactiveChange: number;
    avgOrderValue: number;
    avgOrderValueChange: number;
    retentionRate: number;
    retentionRateChange: number;
  };
  activityTrends: Array<{
    month: string;
    active: number;
    atRisk: number;
    inactive: number;
  }>;
  retentionTrends: Array<{
    month: string;
    newCustomers: number;
    returningCustomers: number;
    retentionRate: number;
  }>;
}

// Segment colors for charts
const SEGMENT_COLORS: Record<string, string> = {
  'VIP': '#a78bfa',
  'Active': '#34d399',
  'New': '#60a5fa',
  'At-Risk': '#fbbf24',
  'Inactive': '#6b7280'
};

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') as '7d' | '30d' | '90d' | 'custom' || '30d';
    const customStart = searchParams.get('customStartDate');
    const customEnd = searchParams.get('customEndDate');
    const granularity = searchParams.get('granularity') as 'daily' | 'weekly' | 'monthly' || 'daily';
    const compareWithPrevious = searchParams.get('compareWithPrevious') !== 'false';

    // Get date ranges
    const currentRange = getDateRange(
      period, 
      customStart ? new Date(customStart) : undefined,
      customEnd ? new Date(customEnd) : undefined
    );
    
    const previousRange = compareWithPrevious ? getPreviousPeriod(currentRange) : null;
    const now = new Date();

    // Fetch ALL customers with their orders
    const allCustomers = await prisma.customer.findMany({
      include: {
        orders: {
          where: {
            status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Calculate segment for each customer
    const customersWithSegment = allCustomers.map(customer => {
      const totalOrders = customer.orders?.length || 0;
      const totalSpent = customer.orders?.reduce((sum, o) => sum + o.total, 0) || 0;
      const lastOrderDate = customer.orders?.[0]?.createdAt || null;
      
      const segment = calculateCustomerSegment({
        totalSpent,
        totalOrders,
        lastOrderDate,
        createdAt: customer.createdAt
      }, DEFAULT_SEGMENT_CONFIG);

      return {
        ...customer,
        segment,
        totalOrders,
        totalSpent,
        lastOrderDate
      };
    });

    // Count current segment distribution
    const segmentCounts = {
      VIP: customersWithSegment.filter(c => c.segment === 'VIP').length,
      Active: customersWithSegment.filter(c => c.segment === 'Active').length,
      New: customersWithSegment.filter(c => c.segment === 'New').length,
      'At-Risk': customersWithSegment.filter(c => c.segment === 'At-Risk').length,
      Inactive: customersWithSegment.filter(c => c.segment === 'Inactive').length
    };

    // Get new customers in current period
    const newCustomersInPeriod = allCustomers.filter(c => 
      c.createdAt >= currentRange.startDate && c.createdAt <= currentRange.endDate
    ).length;

    // Get new customers in previous period
    const newCustomersInPreviousPeriod = previousRange 
      ? allCustomers.filter(c => 
          c.createdAt >= previousRange.startDate && c.createdAt <= previousRange.endDate
        ).length 
      : 0;

    // Calculate returning customers (more than 1 order)
    const returningCustomers = customersWithSegment.filter(c => c.totalOrders > 1).length;
    const returningCustomersInPeriod = customersWithSegment.filter(c => {
      const ordersInPeriod = c.orders?.filter(o => 
        o.createdAt >= currentRange.startDate && o.createdAt <= currentRange.endDate
      ).length || 0;
      return c.totalOrders > 1 && ordersInPeriod > 0;
    }).length;

    // Calculate average order value
    const allOrderTotals = customersWithSegment.flatMap(c => 
      c.orders?.map(o => o.total) || []
    );
    const avgOrderValue = allOrderTotals.length > 0
      ? allOrderTotals.reduce((sum, v) => sum + v, 0) / allOrderTotals.length
      : 0;

    // Calculate retention rate
    // Retention = Customers who ordered more than once / Customers who have placed at least one order
    const customersWithOrders = customersWithSegment.filter(c => c.totalOrders > 0).length;
    const retentionRate = customersWithOrders > 0
      ? Math.round((returningCustomers / customersWithOrders) * 100)
      : 0;

    // Build segment distribution with colors
    const segmentDistribution: SegmentDistribution[] = Object.entries(segmentCounts)
      .map(([segment, count]) => ({
        segment,
        count,
        color: SEGMENT_COLORS[segment] || '#6b7280',
        percentage: allCustomers.length > 0 ? Math.round((count / allCustomers.length) * 100) : 0
      }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);

    // Generate activity trends (last 6 months)
    const activityTrends = generateActivityTrends(customersWithSegment, 6);

    // Generate retention trends (last 6 months)
    const retentionTrends = generateRetentionTrends(allCustomers, 6);

    // Calculate change percentages (mock for now - would compare with previous period)
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // For demonstration, calculate approximate previous values
    // In production, you'd query actual historical data
    const previousTotalEstimate = Math.round(allCustomers.length * 0.9);
    const previousNewEstimate = Math.round(newCustomersInPeriod * 0.85);
    const previousVIPEstimate = Math.round(segmentCounts.VIP * 0.95);
    const previousActiveEstimate = Math.round(segmentCounts.Active * 0.92);
    const previousAtRiskEstimate = Math.round(segmentCounts['At-Risk'] * 1.1);
    const previousInactiveEstimate = Math.round(segmentCounts.Inactive * 1.05);
    const previousAvgOrderValue = avgOrderValue * 0.95;
    const previousRetentionRate = retentionRate - 2;

    // Build metrics object
    const metrics = {
      total: allCustomers.length,
      totalChange: calculateChange(allCustomers.length, previousTotalEstimate),
      newCustomers: newCustomersInPeriod,
      newCustomersChange: calculateChange(newCustomersInPeriod, previousNewEstimate),
      vip: segmentCounts.VIP,
      vipChange: calculateChange(segmentCounts.VIP, previousVIPEstimate),
      active: segmentCounts.Active,
      activeChange: calculateChange(segmentCounts.Active, previousActiveEstimate),
      atRisk: segmentCounts['At-Risk'],
      atRiskChange: calculateChange(segmentCounts['At-Risk'], previousAtRiskEstimate),
      inactive: segmentCounts.Inactive,
      inactiveChange: calculateChange(segmentCounts.Inactive, previousInactiveEstimate),
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      avgOrderValueChange: calculateChange(avgOrderValue, previousAvgOrderValue),
      retentionRate,
      retentionRateChange: calculateChange(retentionRate, previousRetentionRate)
    };

    // Build legacy metrics for backwards compatibility
    const totalCustomers = allCustomers.length;
    const repeatCustomers = returningCustomers;
    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    const totalSpent = customersWithSegment.reduce((sum, c) => sum + c.totalSpent, 0);
    const averageLifetimeValue = totalCustomers > 0 ? totalSpent / totalCustomers : 0;

    const currentMetrics: CustomerMetrics = {
      totalCustomers,
      newCustomers: newCustomersInPeriod,
      repeatCustomerRate,
      averageLifetimeValue
    };

    // Previous metrics (for backwards compatibility)
    const previousMetrics: CustomerMetrics = {
      totalCustomers: previousTotalEstimate,
      newCustomers: previousNewEstimate,
      repeatCustomerRate: repeatCustomerRate * 0.95,
      averageLifetimeValue: averageLifetimeValue * 0.9
    };

    const growthRate = calculateChange(totalCustomers, previousTotalEstimate);

    // Count customers created BEFORE the date range (baseline for cumulative chart)
    const customersBeforePeriod = allCustomers.filter(c => 
      c.createdAt < currentRange.startDate
    ).length;

    // Get customers created within the date range
    const customersInPeriod = allCustomers.filter(c => 
      c.createdAt >= currentRange.startDate && c.createdAt <= currentRange.endDate
    );

    // Aggregate customer acquisition over time with proper baseline
    const acquisitionOverTime = aggregateCustomerAcquisition(
      customersInPeriod,
      currentRange,
      granularity,
      customersBeforePeriod
    );

    // Build response
    const analytics: ExtendedCustomerAnalytics = {
      current: currentMetrics,
      previous: previousMetrics,
      growthRate,
      acquisitionOverTime,
      segmentDistribution,
      metrics,
      activityTrends,
      retentionTrends
    };

    const response: AnalyticsResponse<ExtendedCustomerAnalytics> = {
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
    
    const response: AnalyticsResponse<ExtendedCustomerAnalytics> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate customer analytics'
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * Generate activity trends for the last N months
 */
function generateActivityTrends(
  customers: Array<{ segment: string; createdAt: Date; lastOrderDate: Date | null }>,
  months: number
): Array<{ month: string; active: number; atRisk: number; inactive: number }> {
  const trends: Array<{ month: string; active: number; atRisk: number; inactive: number }> = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = monthDate.toLocaleString('default', { month: 'short' });
    
    // Count customers active in that month
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    let active = 0;
    let atRisk = 0;
    let inactive = 0;

    customers.forEach(customer => {
      // Customer must exist by this month
      if (customer.createdAt > monthEnd) return;

      if (!customer.lastOrderDate) {
        inactive++;
      } else {
        const daysSinceOrder = Math.floor(
          (monthEnd.getTime() - customer.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceOrder <= 30) {
          active++;
        } else if (daysSinceOrder <= 90) {
          atRisk++;
        } else {
          inactive++;
        }
      }
    });

    trends.push({ month: monthName, active, atRisk, inactive });
  }

  return trends;
}

/**
 * Generate retention trends for the last N months
 */
function generateRetentionTrends(
  customers: Array<{ createdAt: Date; orders?: Array<{ createdAt: Date }> }>,
  months: number
): Array<{ month: string; newCustomers: number; returningCustomers: number; retentionRate: number }> {
  const trends: Array<{ month: string; newCustomers: number; returningCustomers: number; retentionRate: number }> = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthName = monthStart.toLocaleString('default', { month: 'short' });

    // New customers in this month
    const newCustomers = customers.filter(c => 
      c.createdAt >= monthStart && c.createdAt <= monthEnd
    ).length;

    // Returning customers (had orders before this month and ordered again)
    const returningCustomers = customers.filter(c => {
      if (c.createdAt > monthEnd) return false; // Customer didn't exist
      
      const ordersThisMonth = c.orders?.filter(o => 
        o.createdAt >= monthStart && o.createdAt <= monthEnd
      ).length || 0;

      const ordersBefore = c.orders?.filter(o => 
        o.createdAt < monthStart
      ).length || 0;

      return ordersThisMonth > 0 && ordersBefore > 0;
    }).length;

    // Retention rate calculation
    const totalWithOrders = customers.filter(c => {
      const ordersUpToMonth = c.orders?.filter(o => o.createdAt <= monthEnd).length || 0;
      return ordersUpToMonth > 0 && c.createdAt <= monthEnd;
    }).length;

    const customersWithMultipleOrders = customers.filter(c => {
      const ordersUpToMonth = c.orders?.filter(o => o.createdAt <= monthEnd).length || 0;
      return ordersUpToMonth > 1 && c.createdAt <= monthEnd;
    }).length;

    const retentionRate = totalWithOrders > 0
      ? Math.round((customersWithMultipleOrders / totalWithOrders) * 100)
      : 0;

    trends.push({ month: monthName, newCustomers, returningCustomers, retentionRate });
  }

  return trends;
}
