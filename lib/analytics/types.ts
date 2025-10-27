/**
 * TypeScript Types for Analytics
 * 
 * Comprehensive type definitions for all analytics data structures.
 */

import { Order, Customer, Product, OrderItem } from '@prisma/client';

// Order with included relations
export type OrderWithDetails = Order & {
  items?: (OrderItem & {
    product?: Product | null;
  })[];
  customer?: Customer | null;
};

// Date Range
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Period types
export type DatePeriod = 'daily' | 'weekly' | 'monthly';
export type DatePreset = '7d' | '30d' | '90d' | 'custom';

// Revenue Analytics
export interface RevenueMetrics {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
}

export interface RevenueByCategory {
  category: string;
  revenue: number;
  percentage: number;
}

export interface RevenueAnalytics {
  current: RevenueMetrics;
  previous: RevenueMetrics;
  growthRate: number;
  revenueOverTime: RevenueData[];
  revenueByCategory: RevenueByCategory[];
}

// Product Analytics
export interface ProductPerformance {
  productId: string;
  productName: string;
  revenue: number;
  unitsSold: number;
  averagePrice: number;
}

export interface ProductAnalytics {
  topProductsByRevenue: ProductPerformance[];
  topProductsByUnits: ProductPerformance[];
  totalProducts: number;
  totalRevenue: number;
  totalUnitsSold: number;
}

// Customer Analytics
export interface CustomerAcquisition {
  date: string;
  newCustomers: number;
  totalCustomers: number;
}

export interface SegmentDistribution {
  segment: string;
  count: number;
  percentage: number;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  repeatCustomerRate: number;
  averageLifetimeValue: number;
}

export interface CustomerAnalytics {
  current: CustomerMetrics;
  previous: CustomerMetrics;
  growthRate: number;
  acquisitionOverTime: CustomerAcquisition[];
  segmentDistribution: SegmentDistribution[];
}

// Order Analytics
export interface OrderStatusCount {
  status: string;
  count: number;
  percentage: number;
}

export interface OrdersOverTime {
  date: string;
  count: number;
  revenue: number;
}

export interface OrderMetrics {
  totalOrders: number;
  averageFulfillmentTime: number;
  completionRate: number;
}

export interface OrderAnalytics {
  current: OrderMetrics;
  previous: OrderMetrics;
  growthRate: number;
  ordersOverTime: OrdersOverTime[];
  statusDistribution: OrderStatusCount[];
}

// Dashboard Analytics (Combined)
export interface DashboardAnalytics {
  revenue: RevenueAnalytics;
  products: ProductAnalytics;
  customers: CustomerAnalytics;
  orders: OrderAnalytics;
  dateRange: DateRange;
  comparisonPeriod: DateRange;
}

// API Request Types
export interface AnalyticsRequest {
  period: DatePreset;
  customStartDate?: string;
  customEndDate?: string;
  granularity?: DatePeriod;
  compareWithPrevious?: boolean;
}

// API Response Types
export interface AnalyticsResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    dateRange: DateRange;
    comparisonPeriod?: DateRange;
    generatedAt: string;
  };
}

// Chart Data Types
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface LineChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

export interface BarChartData {
  labels: string[];
  data: number[];
  colors?: string[];
}

export interface PieChartData {
  labels: string[];
  data: number[];
  colors: string[];
}

// Metric Card Types
export interface MetricCardData {
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  icon?: string;
  sparklineData?: number[];
}

// Export Types
export type ExportFormat = 'csv' | 'pdf' | 'json';

export interface ExportRequest {
  format: ExportFormat;
  analytics: DashboardAnalytics;
  filename?: string;
}
