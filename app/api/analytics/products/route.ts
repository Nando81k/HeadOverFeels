/**
 * Product Analytics API
 * 
 * GET /api/analytics/products
 * Returns product performance metrics and top products
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  getDateRange,
  getTopProductsByRevenue,
  getTopProductsByUnits
} from '@/lib/analytics/calculations';
import type { ProductAnalytics, AnalyticsResponse } from '@/lib/analytics/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') as '7d' | '30d' | '90d' | 'custom' || '30d';
    const customStart = searchParams.get('customStartDate');
    const customEnd = searchParams.get('customEndDate');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get date range
    const dateRange = getDateRange(
      period, 
      customStart ? new Date(customStart) : undefined,
      customEnd ? new Date(customEnd) : undefined
    );

    // Fetch orders with product details
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
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

    // Calculate product performance
    const topProductsByRevenue = getTopProductsByRevenue(orders, limit);
    const topProductsByUnits = getTopProductsByUnits(orders, limit);

    // Calculate totals
    const totalRevenue = topProductsByRevenue.reduce((sum, p) => sum + p.revenue, 0);
    const totalUnitsSold = topProductsByUnits.reduce((sum, p) => sum + p.unitsSold, 0);
    const uniqueProducts = new Set([
      ...topProductsByRevenue.map(p => p.productId),
      ...topProductsByUnits.map(p => p.productId)
    ]).size;

    // Build response
    const analytics: ProductAnalytics = {
      topProductsByRevenue,
      topProductsByUnits,
      totalProducts: uniqueProducts,
      totalRevenue,
      totalUnitsSold
    };

    const response: AnalyticsResponse<ProductAnalytics> = {
      success: true,
      data: analytics,
      metadata: {
        dateRange,
        generatedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Product analytics error:', error);
    
    const response: AnalyticsResponse<ProductAnalytics> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate product analytics'
    };

    return NextResponse.json(response, { status: 500 });
  }
}
