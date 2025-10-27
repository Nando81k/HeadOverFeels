# Phase 3: Analytics Dashboard - Implementation Plan

## 🎯 Overview

Building a comprehensive analytics dashboard to visualize business metrics, track performance, and enable data-driven decisions. This phase leverages the CRM data from Phase 2 to provide actionable insights.

**Timeline**: 2-3 days  
**Complexity**: Medium-High  
**Dependencies**: CRM data (Phase 2 ✅), Order system ✅

---

## 📊 Features to Build

### 1. Revenue Analytics
- **Revenue over time chart** (daily/weekly/monthly views)
- **Total revenue metric** with period comparison
- **Average order value (AOV)** tracking
- **Revenue by category** breakdown
- **Growth rate indicators** (% change vs previous period)

### 2. Product Performance
- **Top products by revenue** (bar chart)
- **Top products by units sold** (bar chart)
- **Product category performance** comparison
- **Limited drop performance** tracking
- **Low stock alerts** with sales velocity

### 3. Customer Analytics
- **New customers over time** (area chart)
- **Customer acquisition rate**
- **Customer segment distribution** (pie chart - VIP, New, Active, etc.)
- **Customer lifetime value trends**
- **Repeat customer rate**

### 4. Order Analytics
- **Order status breakdown** (pie/donut chart)
- **Orders over time** (line chart)
- **Average fulfillment time**
- **Order value distribution**
- **Peak ordering times** (day/hour heatmap - optional)

### 5. Dashboard Features
- **Date range selector** (7/30/90 days, custom range)
- **Period comparison** (vs previous week/month)
- **Metric cards** with sparklines
- **Export to CSV/PDF**
- **Real-time updates** (optional)
- **Filters**: category, product, customer segment

---

## 🏗️ Technical Architecture

### Libraries & Tools
```json
{
  "recharts": "^2.10.0",  // Chart library
  "date-fns": "^3.0.0",   // Date manipulation (already installed)
  "jspdf": "^2.5.0",      // PDF export (optional)
  "react-to-print": "^2.15.0"  // Print support (optional)
}
```

### File Structure
```
/app
  /admin
    /analytics
      page.tsx              # Main analytics dashboard
      /revenue
        page.tsx            # Detailed revenue analytics
      /products
        page.tsx            # Product performance details
      /customers
        page.tsx            # Customer analytics details
  /api
    /analytics
      /revenue
        route.ts            # Revenue metrics API
      /products
        route.ts            # Product performance API
      /customers
        route.ts            # Customer analytics API
      /orders
        route.ts            # Order analytics API

/components
  /analytics
    RevenueChart.tsx        # Line/bar chart for revenue
    ProductPerformanceChart.tsx  # Bar chart for products
    CustomerAcquisitionChart.tsx # Area chart for customers
    OrderStatusChart.tsx    # Pie/donut chart for orders
    MetricCard.tsx          # Stat card with sparkline
    DateRangeSelector.tsx   # Date picker component
    ComparisonIndicator.tsx # Up/down arrow with %
    AnalyticsExport.tsx     # Export functionality

/lib
  /analytics
    calculations.ts         # Metric calculation utilities
    date-helpers.ts         # Date range helpers
    export-helpers.ts       # CSV/PDF export utilities
```

### Data Flow
```
User selects date range
    ↓
Dashboard fetches analytics data from API
    ↓
API queries Prisma with date filters
    ↓
Calculate metrics (sum, avg, count, growth)
    ↓
Return formatted data to dashboard
    ↓
Recharts renders interactive visualizations
```

---

## 📋 Implementation Checklist

### Phase 3.1: Foundation (4-5 hours)

**Setup & Dependencies**
- [ ] Install recharts library
- [ ] Create analytics utility functions
- [ ] Set up TypeScript interfaces for metrics
- [ ] Create date range helper functions

**Revenue Analytics API**
- [ ] `/api/analytics/revenue` endpoint
  - [ ] Total revenue calculation
  - [ ] Revenue by day/week/month aggregation
  - [ ] Revenue by category
  - [ ] Period comparison logic
  - [ ] Average order value calculation

**Revenue Chart Component**
- [ ] RevenueChart.tsx with line/bar toggle
- [ ] Responsive design
- [ ] Tooltips with formatted values
- [ ] Period comparison overlay
- [ ] Loading states

**Dashboard Layout**
- [ ] Create `/admin/analytics/page.tsx`
- [ ] Date range selector
- [ ] 4-card metric grid (Revenue, Orders, Customers, AOV)
- [ ] Revenue chart section
- [ ] Responsive grid layout

### Phase 3.2: Product & Customer Analytics (4-5 hours)

**Product Performance API**
- [ ] `/api/analytics/products` endpoint
  - [ ] Top products by revenue
  - [ ] Top products by units sold
  - [ ] Category performance
  - [ ] Limited drop performance
  - [ ] Inventory velocity

**Customer Analytics API**
- [ ] `/api/analytics/customers` endpoint
  - [ ] New customers over time
  - [ ] Customer segment distribution
  - [ ] Repeat customer rate
  - [ ] Customer lifetime value trends
  - [ ] Acquisition sources (if available)

**Chart Components**
- [ ] ProductPerformanceChart.tsx (bar chart)
- [ ] CustomerAcquisitionChart.tsx (area chart)
- [ ] CustomerSegmentChart.tsx (pie/donut chart)
- [ ] OrderStatusChart.tsx (pie chart)

**Dashboard Integration**
- [ ] Add product performance section
- [ ] Add customer analytics section
- [ ] Add order status section
- [ ] Implement chart grid layout

### Phase 3.3: Advanced Features & Polish (3-4 hours)

**Comparison Features**
- [ ] ComparisonIndicator component (↑↓ with %)
- [ ] Previous period data fetching
- [ ] Growth rate calculations
- [ ] Trend indicators on metric cards

**Filtering**
- [ ] Category filter dropdown
- [ ] Product filter search
- [ ] Customer segment filter
- [ ] Order status filter

**Export Functionality**
- [ ] Export to CSV (all metrics)
- [ ] Export charts as images
- [ ] Print-friendly view
- [ ] PDF export (optional)

**Performance Optimization**
- [ ] API response caching (if needed)
- [ ] Lazy load charts
- [ ] Skeleton loading states
- [ ] Error boundaries

**Testing & Documentation**
- [ ] Test script for metric calculations
- [ ] Test date range edge cases
- [ ] Verify chart rendering
- [ ] Create ANALYTICS_COMPLETE.md documentation

### Phase 3.4: Dashboard Integration (1-2 hours)

**Main Dashboard Widgets**
- [ ] Add "Analytics" card to /admin
- [ ] Mini revenue chart widget (sparkline)
- [ ] Top 3 products widget
- [ ] Recent trends widget

**Navigation**
- [ ] Add Analytics to admin nav
- [ ] Link metric cards to detailed views
- [ ] Breadcrumb navigation

---

## 🎨 UI/UX Design

### Color Palette (Analytics-specific)
- **Revenue**: Purple gradient (`#9333EA` → `#7C3AED`)
- **Orders**: Blue gradient (`#3B82F6` → `#2563EB`)
- **Customers**: Green gradient (`#10B981` → `#059669`)
- **Products**: Orange gradient (`#F59E0B` → `#D97706`)
- **Positive trends**: Green (`#10B981`)
- **Negative trends**: Red (`#EF4444`)

### Metric Card Layout
```
┌──────────────────────────────────┐
│ Total Revenue              ↑ 12% │
│ $12,450.00                        │
│ ━━━━━━━━━━━━━━━━ (sparkline)     │
│ vs previous period: +$1,340       │
└──────────────────────────────────┘
```

### Chart Grid Layout
```
┌─────────────────────────────────────────┐
│  Date Range: [Last 30 days ▼]  [Export]│
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │Rev  │ │Orders│ │Cust │ │AOV  │        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
├─────────────────────────────────────────┤
│ ┌───────────────────────────────┐       │
│ │  Revenue Over Time (Chart)    │       │
│ └───────────────────────────────┘       │
├─────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐       │
│ │ Top Products │ │ Order Status │       │
│ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────┘
```

---

## 📊 Sample API Response Formats

### Revenue API (`/api/analytics/revenue`)
```typescript
{
  success: true,
  data: {
    totalRevenue: 12450.00,
    previousPeriodRevenue: 11110.00,
    growthRate: 12.06,
    averageOrderValue: 37.50,
    revenueByPeriod: [
      { date: '2025-10-01', revenue: 450.00, orders: 12 },
      { date: '2025-10-02', revenue: 520.00, orders: 14 },
      // ...
    ],
    revenueByCategory: [
      { category: 'Hoodies', revenue: 5200.00, percentage: 41.8 },
      { category: 'T-Shirts', revenue: 3800.00, percentage: 30.5 },
      // ...
    ]
  }
}
```

### Product Performance API (`/api/analytics/products`)
```typescript
{
  success: true,
  data: {
    topProductsByRevenue: [
      { 
        productId: 'xxx',
        name: 'Limited Drop Hoodie',
        revenue: 2500.00,
        unitsSold: 50,
        growthRate: 25.5
      },
      // ...
    ],
    topProductsByUnits: [...],
    categoryPerformance: [...]
  }
}
```

### Customer Analytics API (`/api/analytics/customers`)
```typescript
{
  success: true,
  data: {
    totalCustomers: 150,
    newCustomers: 25,
    growthRate: 20.0,
    customersByPeriod: [
      { date: '2025-10-01', newCustomers: 2, totalCustomers: 130 },
      // ...
    ],
    segmentDistribution: [
      { segment: 'VIP', count: 15, percentage: 10 },
      { segment: 'Active', count: 80, percentage: 53.3 },
      // ...
    ],
    repeatCustomerRate: 35.5
  }
}
```

---

## 🧮 Metric Calculations

### Revenue Metrics
```typescript
// Total Revenue = Sum of all completed order totals in period
totalRevenue = orders
  .filter(o => o.status in ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
  .reduce((sum, o) => sum + o.total, 0);

// Average Order Value = Total Revenue / Number of Orders
averageOrderValue = totalRevenue / orderCount;

// Growth Rate = ((Current - Previous) / Previous) * 100
growthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
```

### Customer Metrics
```typescript
// New Customers = Count of customers created in period
newCustomers = customers.filter(c => c.createdAt >= startDate && c.createdAt <= endDate).length;

// Repeat Customer Rate = (Customers with >1 order / Total customers) * 100
repeatCustomerRate = (customersWithMultipleOrders / totalCustomers) * 100;

// Customer Acquisition Cost = Marketing spend / New customers (if available)
```

### Product Metrics
```typescript
// Revenue by Product = Sum of order items * price for product
productRevenue = orderItems
  .filter(i => i.productId === productId)
  .reduce((sum, i) => sum + (i.quantity * i.price), 0);

// Sales Velocity = Units sold / Days in period
salesVelocity = unitsSold / daysInPeriod;
```

---

## 🚀 Quick Start

Once implementation begins, you'll be able to:

1. **View Dashboard**: http://localhost:3000/admin/analytics
2. **Select Date Range**: Last 7/30/90 days or custom
3. **See Metrics**: Revenue, orders, customers, AOV with trends
4. **Interact with Charts**: Hover for details, click to drill down
5. **Export Data**: Download CSV of all metrics
6. **Compare Periods**: Toggle to see growth vs previous period

---

## 🎯 Success Metrics

**Phase 3 Complete When:**
- [ ] All metric cards show accurate data
- [ ] Revenue chart displays correctly with date ranges
- [ ] Product performance chart shows top 10 products
- [ ] Customer acquisition chart shows growth trend
- [ ] Order status pie chart shows distribution
- [ ] Period comparison indicators work
- [ ] Export to CSV functions correctly
- [ ] Responsive design works on mobile
- [ ] Documentation is complete
- [ ] Test script validates calculations

---

## 📚 Related Documentation

- **Phase 1**: Admin Dashboard (ADMIN_IMPLEMENTATION.md)
- **Phase 2**: Customer CRM (CUSTOMER_CRM_COMPLETE.md)
- **Recharts Docs**: https://recharts.org/
- **Date-fns Guide**: https://date-fns.org/

---

**Status**: 🚧 **IN PROGRESS**  
**Started**: October 25, 2025  
**Estimated Completion**: October 27, 2025
