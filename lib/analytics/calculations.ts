/**
 * Analytics Calculation Utilities
 * 
 * Core functions for calculating business metrics from database data.
 * Used by analytics API endpoints and dashboard components.
 */

import { startOfDay, endOfDay, subDays, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth } from 'date-fns';
import { Customer } from '@prisma/client';
import type { 
  DateRange, 
  RevenueData, 
  ProductPerformance, 
  CustomerAcquisition, 
  OrderWithDetails,
  RevenueByCategory,
  OrderStatusCount
} from './types';

// Completed order statuses that count toward revenue
export const COMPLETED_ORDER_STATUSES = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

/**
 * Get date range based on preset or custom dates
 */
export function getDateRange(preset: '7d' | '30d' | '90d' | 'custom', customStart?: Date, customEnd?: Date): DateRange {
  const now = new Date();
  
  switch (preset) {
    case '7d':
      return {
        startDate: startOfDay(subDays(now, 7)),
        endDate: endOfDay(now)
      };
    case '30d':
      return {
        startDate: startOfDay(subDays(now, 30)),
        endDate: endOfDay(now)
      };
    case '90d':
      return {
        startDate: startOfDay(subDays(now, 90)),
        endDate: endOfDay(now)
      };
    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom date range requires start and end dates');
      }
      return {
        startDate: startOfDay(customStart),
        endDate: endOfDay(customEnd)
      };
  }
}

/**
 * Get previous period date range for comparison
 */
export function getPreviousPeriod(currentRange: DateRange): DateRange {
  const duration = currentRange.endDate.getTime() - currentRange.startDate.getTime();
  const durationInDays = Math.ceil(duration / (1000 * 60 * 60 * 24));
  
  return {
    startDate: startOfDay(subDays(currentRange.startDate, durationInDays)),
    endDate: endOfDay(subDays(currentRange.endDate, durationInDays))
  };
}

/**
 * Calculate growth rate between two values
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Calculate revenue metrics from orders
 */
export function calculateRevenueMetrics(orders: OrderWithDetails[]) {
  const completedOrders = orders.filter(o => 
    COMPLETED_ORDER_STATUSES.includes(o.status as typeof COMPLETED_ORDER_STATUSES[number])
  );
  
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const orderCount = completedOrders.length;
  const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
  
  return {
    totalRevenue,
    orderCount,
    averageOrderValue
  };
}

/**
 * Aggregate revenue by date period (daily/weekly/monthly)
 */
export function aggregateRevenueByPeriod(
  orders: OrderWithDetails[], 
  dateRange: DateRange,
  period: 'daily' | 'weekly' | 'monthly' = 'daily'
): RevenueData[] {
  const completedOrders = orders.filter(o => 
    COMPLETED_ORDER_STATUSES.includes(o.status as typeof COMPLETED_ORDER_STATUSES[number])
  );
  
  let intervals: Date[];
  let formatStr: string;
  
  switch (period) {
    case 'daily':
      intervals = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
      formatStr = 'yyyy-MM-dd';
      break;
    case 'weekly':
      intervals = eachWeekOfInterval({ start: dateRange.startDate, end: dateRange.endDate }).map(d => startOfWeek(d));
      formatStr = 'yyyy-MM-dd';
      break;
    case 'monthly':
      intervals = eachMonthOfInterval({ start: dateRange.startDate, end: dateRange.endDate }).map(d => startOfMonth(d));
      formatStr = 'yyyy-MM';
      break;
  }
  
  return intervals.map(date => {
    const dateStr = format(date, formatStr);
    const dateOrders = completedOrders.filter(o => {
      const orderDate = format(new Date(o.createdAt), formatStr);
      return orderDate === dateStr;
    });
    
    return {
      date: dateStr,
      revenue: dateOrders.reduce((sum, o) => sum + o.total, 0),
      orders: dateOrders.length
    };
  });
}

/**
 * Calculate revenue by category
 * Note: Currently uses categoryId since category relation isn't included
 * For full category names, include category relation in query
 */
export function aggregateRevenueByCategory(orders: OrderWithDetails[]): RevenueByCategory[] {
  const completedOrders = orders.filter(o => 
    COMPLETED_ORDER_STATUSES.includes(o.status as typeof COMPLETED_ORDER_STATUSES[number])
  );
  
  const categoryMap = new Map<string, number>();
  let totalRevenue = 0;
  
  completedOrders.forEach(order => {
    order.items?.forEach((item) => {
      const category = item.product?.categoryId || 'Uncategorized';
      const itemRevenue = item.quantity * item.price;
      categoryMap.set(category, (categoryMap.get(category) || 0) + itemRevenue);
      totalRevenue += itemRevenue;
    });
  });
  
  return Array.from(categoryMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Calculate top products by revenue
 */
export function getTopProductsByRevenue(orders: OrderWithDetails[], limit: number = 10): ProductPerformance[] {
  const completedOrders = orders.filter(o => 
    COMPLETED_ORDER_STATUSES.includes(o.status as typeof COMPLETED_ORDER_STATUSES[number])
  );
  
  const productMap = new Map<string, { name: string; revenue: number; units: number; }>();
  
  completedOrders.forEach(order => {
    order.items?.forEach((item) => {
      const productId = item.productId;
      const productName = item.product?.name || item.productName || 'Unknown Product';
      const itemRevenue = item.quantity * item.price;
      
      const existing = productMap.get(productId);
      if (existing) {
        existing.revenue += itemRevenue;
        existing.units += item.quantity;
      } else {
        productMap.set(productId, {
          name: productName,
          revenue: itemRevenue,
          units: item.quantity
        });
      }
    });
  });
  
  return Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      revenue: data.revenue,
      unitsSold: data.units,
      averagePrice: data.units > 0 ? data.revenue / data.units : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Calculate top products by units sold
 */
export function getTopProductsByUnits(orders: OrderWithDetails[], limit: number = 10): ProductPerformance[] {
  const completedOrders = orders.filter(o => 
    COMPLETED_ORDER_STATUSES.includes(o.status as typeof COMPLETED_ORDER_STATUSES[number])
  );
  
  const productMap = new Map<string, { name: string; revenue: number; units: number; }>();
  
  completedOrders.forEach(order => {
    order.items?.forEach((item) => {
      const productId = item.productId;
      const productName = item.product?.name || item.productName || 'Unknown Product';
      const itemRevenue = item.quantity * item.price;
      
      const existing = productMap.get(productId);
      if (existing) {
        existing.revenue += itemRevenue;
        existing.units += item.quantity;
      } else {
        productMap.set(productId, {
          name: productName,
          revenue: itemRevenue,
          units: item.quantity
        });
      }
    });
  });
  
  return Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      revenue: data.revenue,
      unitsSold: data.units,
      averagePrice: data.units > 0 ? data.revenue / data.units : 0
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, limit);
}

/**
 * Aggregate customer acquisition by date period
 */
export function aggregateCustomerAcquisition(
  customers: Customer[],
  dateRange: DateRange,
  period: 'daily' | 'weekly' | 'monthly' = 'daily'
): CustomerAcquisition[] {
  let intervals: Date[];
  let formatStr: string;
  
  switch (period) {
    case 'daily':
      intervals = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
      formatStr = 'yyyy-MM-dd';
      break;
    case 'weekly':
      intervals = eachWeekOfInterval({ start: dateRange.startDate, end: dateRange.endDate }).map(d => startOfWeek(d));
      formatStr = 'yyyy-MM-dd';
      break;
    case 'monthly':
      intervals = eachMonthOfInterval({ start: dateRange.startDate, end: dateRange.endDate }).map(d => startOfMonth(d));
      formatStr = 'yyyy-MM';
      break;
  }
  
  let cumulativeTotal = 0;
  
  return intervals.map(date => {
    const dateStr = format(date, formatStr);
    const newCustomers = customers.filter(c => {
      const customerDate = format(new Date(c.createdAt), formatStr);
      return customerDate === dateStr;
    }).length;
    
    cumulativeTotal += newCustomers;
    
    return {
      date: dateStr,
      newCustomers,
      totalCustomers: cumulativeTotal
    };
  });
}

/**
 * Calculate order status distribution
 */
export function getOrderStatusDistribution(orders: OrderWithDetails[]): OrderStatusCount[] {
  const statusMap = new Map<string, number>();
  const total = orders.length;
  
  orders.forEach(order => {
    const status = order.status;
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
  });
  
  return Array.from(statusMap.entries())
    .map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
