// tests/unit/components/admin/analytics/SalesTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── mock heavy client components ─────────────────────────────────────────────

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Line: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

// LiveFeedSidebar polls fetch — stub it out
vi.mock('@/components/admin/analytics/LiveFeedSidebar', () => ({
  LiveFeedSidebar: () => <div data-testid="live-feed-sidebar-mock">Live Feed</div>,
}))

// ExportButton invokes server actions — stub it out
vi.mock('@/app/admin/analytics/actions', () => ({
  exportOverviewCsv: vi.fn(),
  exportSalesCsv: vi.fn(),
  exportCustomersCsv: vi.fn(),
  exportProductsCsv: vi.fn(),
  exportFinancialCsv: vi.fn(),
  exportExpensesCsv: vi.fn(),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── import after mocks ────────────────────────────────────────────────────────
import { SalesTab } from '@/components/admin/analytics/SalesTab'
import type { SalesData } from '@/lib/admin/analytics'

// ── fixtures ──────────────────────────────────────────────────────────────────

const emptySalesData: SalesData = {
  revenueTrend: [],
  topProducts: [],
}

const filledSalesData: SalesData = {
  revenueTrend: [
    { bucket: '2026-05-01', value: 1200 },
    { bucket: '2026-05-02', value: 980 },
    { bucket: '2026-05-03', value: 1500 },
  ],
  topProducts: [
    { productId: 'p1', name: 'Classic Tee', unitsSold: 42, revenue: 1050 },
    { productId: 'p2', name: 'Hoodie', unitsSold: 20, revenue: 800 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SalesTab', () => {
  it('renders the section wrapper', () => {
    render(<SalesTab data={emptySalesData} range="30d" />)
    expect(screen.getByTestId('sales-tab')).toBeTruthy()
  })

  it('renders the section heading', () => {
    render(<SalesTab data={emptySalesData} range="30d" />)
    expect(screen.getByText(/^sales$/i)).toBeTruthy()
  })

  it('renders the ExportButton', () => {
    render(<SalesTab data={emptySalesData} range="30d" />)
    // ExportButton renders a button with "Export CSV" text
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
  })

  it('renders the revenue trend panel', () => {
    render(<SalesTab data={filledSalesData} range="7d" />)
    expect(screen.getByTestId('sales-revenue-panel')).toBeTruthy()
    expect(screen.getByText(/revenue trend/i)).toBeTruthy()
  })

  it('renders RevenueTrendChart (via Recharts mock)', () => {
    render(<SalesTab data={filledSalesData} range="7d" />)
    // RevenueTrendChart renders a LineChart when data present
    expect(screen.getByTestId('line-chart')).toBeTruthy()
  })

  it('renders the top products panel', () => {
    render(<SalesTab data={filledSalesData} range="30d" />)
    expect(screen.getByTestId('sales-top-products-panel')).toBeTruthy()
    expect(screen.getByText(/top products/i)).toBeTruthy()
  })

  it('renders TopProductsBar (via Recharts mock)', () => {
    render(<SalesTab data={filledSalesData} range="30d" />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
  })

  it('renders LiveFeedSidebar panel', () => {
    render(<SalesTab data={emptySalesData} range="30d" />)
    expect(screen.getByTestId('sales-live-feed-panel')).toBeTruthy()
    expect(screen.getByTestId('live-feed-sidebar-mock')).toBeTruthy()
  })

  it('renders "No data for this range" when revenueTrend is empty', () => {
    render(<SalesTab data={emptySalesData} range="year" />)
    // RevenueTrendChart empty state message
    expect(screen.getAllByText(/no data for this range/i).length).toBeGreaterThan(0)
  })

  it('renders with different TimeRange values without crashing', () => {
    const ranges = ['today', '7d', '30d', '90d', 'year'] as const
    for (const range of ranges) {
      const { unmount } = render(<SalesTab data={filledSalesData} range={range} />)
      expect(screen.getByTestId('sales-tab')).toBeTruthy()
      unmount()
    }
  })
})
