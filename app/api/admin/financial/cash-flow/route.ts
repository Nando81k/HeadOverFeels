import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

interface DailyData {
  date: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
}

interface Projection {
  period: string;
  projectedRevenue: number;
  projectedOrders: number;
  confidence: "high" | "medium" | "low";
  trend: "up" | "down" | "stable";
  changePercent: number;
}

interface CashFlowData {
  historical: DailyData[];
  projections: {
    next30Days: Projection;
    next60Days: Projection;
    next90Days: Projection;
  };
  summary: {
    last30DaysRevenue: number;
    last60DaysRevenue: number;
    last90DaysRevenue: number;
    growthRate: number;
    avgDailyRevenue: number;
    trendDirection: "up" | "down" | "stable";
  };
}

// Valid order statuses for revenue calculation
const VALID_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const adminVerified = await verifyAdmin(request);
  if (!adminVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get date 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Fetch orders from last 90 days
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: ninetyDaysAgo,
        },
        status: {
          in: VALID_STATUSES,
        },
      },
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Group orders by day
    const dailyDataMap = new Map<string, DailyData>();

    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      const existing = dailyDataMap.get(dateKey);

      if (existing) {
        existing.revenue += order.total;
        existing.orders += 1;
        existing.avgOrderValue = existing.revenue / existing.orders;
      } else {
        dailyDataMap.set(dateKey, {
          date: dateKey,
          revenue: order.total,
          orders: 1,
          avgOrderValue: order.total,
        });
      }
    }

    // Fill in missing days with zero revenue
    const allDates: DailyData[] = [];
    const today = new Date();
    for (let i = 90; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];

      allDates.push(
        dailyDataMap.get(dateKey) || {
          date: dateKey,
          revenue: 0,
          orders: 0,
          avgOrderValue: 0,
        }
      );
    }

    // Calculate summary statistics
    const last30Days = allDates.slice(-30);
    const last60Days = allDates.slice(-60);
    const last90Days = allDates;

    const last30DaysRevenue = last30Days.reduce((sum, d) => sum + d.revenue, 0);
    const last60DaysRevenue = last60Days.reduce((sum, d) => sum + d.revenue, 0);
    const last90DaysRevenue = last90Days.reduce((sum, d) => sum + d.revenue, 0);

    const avgDailyRevenue = last30DaysRevenue / 30;

    // Calculate growth rate (comparing last 30 days to previous 30 days)
    const previous30Days = allDates.slice(-60, -30);
    const previous30DaysRevenue = previous30Days.reduce((sum, d) => sum + d.revenue, 0);
    const growthRate =
      previous30DaysRevenue > 0
        ? ((last30DaysRevenue - previous30DaysRevenue) / previous30DaysRevenue) * 100
        : 0;

    // Determine trend direction
    let trendDirection: "up" | "down" | "stable" = "stable";
    if (growthRate > 5) trendDirection = "up";
    else if (growthRate < -5) trendDirection = "down";

    // Linear regression for projections
    const calculateProjection = (
      historicalData: DailyData[],
      daysAhead: number
    ): Projection => {
      // Simple linear regression
      const n = historicalData.length;
      const sumX = (n * (n - 1)) / 2; // Sum of indices 0 to n-1
      const sumY = historicalData.reduce((sum, d) => sum + d.revenue, 0);
      const sumXY = historicalData.reduce((sum, d, i) => sum + i * d.revenue, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Project future revenue
      let projectedRevenue = 0;
      for (let i = 0; i < daysAhead; i++) {
        const dayIndex = n + i;
        const dayRevenue = Math.max(0, slope * dayIndex + intercept);
        projectedRevenue += dayRevenue;
      }

      // Project orders based on average order value
      const avgOrderValue =
        historicalData.reduce((sum, d) => sum + d.avgOrderValue, 0) / n;
      const projectedOrders = Math.round(
        avgOrderValue > 0 ? projectedRevenue / avgOrderValue : 0
      );

      // Calculate confidence based on data consistency
      const revenueStdDev = calculateStdDev(historicalData.map((d) => d.revenue));
      const avgRevenue = sumY / n;
      const coefficientOfVariation = avgRevenue > 0 ? revenueStdDev / avgRevenue : 1;

      let confidence: "high" | "medium" | "low" = "medium";
      if (coefficientOfVariation < 0.3) confidence = "high";
      else if (coefficientOfVariation > 0.6) confidence = "low";

      // Calculate change percent vs historical average
      const historicalAvgDaily = sumY / n;
      const projectedAvgDaily = projectedRevenue / daysAhead;
      const changePercent =
        historicalAvgDaily > 0
          ? ((projectedAvgDaily - historicalAvgDaily) / historicalAvgDaily) * 100
          : 0;

      // Determine trend
      let trend: "up" | "down" | "stable" = "stable";
      if (slope > avgRevenue * 0.01) trend = "up";
      else if (slope < -avgRevenue * 0.01) trend = "down";

      return {
        period: `${daysAhead} days`,
        projectedRevenue: Math.round(projectedRevenue),
        projectedOrders,
        confidence,
        trend,
        changePercent,
      };
    };

    const projections = {
      next30Days: calculateProjection(last90Days, 30),
      next60Days: calculateProjection(last90Days, 60),
      next90Days: calculateProjection(last90Days, 90),
    };

    // Adjust confidence for longer projections
    if (projections.next60Days.confidence === "high") {
      projections.next60Days.confidence = "medium";
    }
    if (projections.next90Days.confidence !== "low") {
      projections.next90Days.confidence = "medium";
    }

    const cashFlowData: CashFlowData = {
      historical: allDates,
      projections,
      summary: {
        last30DaysRevenue,
        last60DaysRevenue,
        last90DaysRevenue,
        growthRate,
        avgDailyRevenue,
        trendDirection,
      },
    };

    return NextResponse.json(cashFlowData);
  } catch (error) {
    console.error("Error calculating cash flow:", error);
    return NextResponse.json(
      { error: "Failed to calculate cash flow projections" },
      { status: 500 }
    );
  }
}

// Helper function to calculate standard deviation
function calculateStdDev(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / n;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  return Math.sqrt(variance);
}
