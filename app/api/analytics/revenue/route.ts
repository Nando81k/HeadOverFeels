/**
 * Revenue Analytics API
 * 
 * GET /api/analytics/revenue
 * Returns comprehensive revenue metrics and time-series data
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  getDateRange, 
  getPreviousPeriod, 
  calculateGrowthRate,
  calculateRevenueMetrics,
  aggregateRevenueByPeriod,
  aggregateRevenueByCategory
} from '@/lib/analytics/calculations';
import type { RevenueAnalytics, AnalyticsResponse } from '@/lib/analytics/types';

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

    // Fetch current period orders with relations
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
        },
        customer: true
      }
    });

    // Fetch previous period orders if comparison requested
    const previousOrders = previousRange ? await prisma.order.findMany({
      where: {
        createdAt: {
          gte: previousRange.startDate,
          lte: previousRange.endDate
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        customer: true
      }
    }) : [];

    // Calculate metrics for current period
    const currentMetrics = calculateRevenueMetrics(currentOrders);
    
    // Calculate metrics for previous period
    const previousMetrics = previousRange 
      ? calculateRevenueMetrics(previousOrders)
      : { totalRevenue: 0, orderCount: 0, averageOrderValue: 0 };

    // Calculate growth rate
    const growthRate = calculateGrowthRate(
      currentMetrics.totalRevenue, 
      previousMetrics.totalRevenue
    );

    // Aggregate revenue over time
    const revenueOverTime = aggregateRevenueByPeriod(
      currentOrders, 
      currentRange, 
      granularity
    );

    // Aggregate revenue by category
    const revenueByCategory = aggregateRevenueByCategory(currentOrders);

    // Build response
    const analytics: RevenueAnalytics = {
      current: currentMetrics,
      previous: previousMetrics,
      growthRate,
      revenueOverTime,
      revenueByCategory
    };

    const response: AnalyticsResponse<RevenueAnalytics> = {
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
    console.error('Revenue analytics error:', error);
    
    const response: AnalyticsResponse<RevenueAnalytics> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate revenue analytics'
    };

    return NextResponse.json(response, { status: 500 });
  }
}
