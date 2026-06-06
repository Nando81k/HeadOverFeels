// tests/unit/components/admin/analytics/FinancialTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── Mock recharts (used by RevenueExpenseArea + MarginTrendChart) ──────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

// ── Mock ExportButton (client component — avoids action import issues) ─────
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: ({ tab, range }: { tab: string; range: string }) => (
    <button data-testid="export-btn" data-tab={tab} data-range={range}>
      Export CSV
    </button>
  ),
}))

import { FinancialTab } from '@/components/admin/analytics/FinancialTab'
import type { FinancialData } from '@/lib/admin/analytics'

// ── Shared fixtures ────────────────────────────────────────────────────────

const emptyData: FinancialData = {
  revenueExpenseTrend: [],
  marginTrend: [],
  taxSummary: [],
  periodGrid: [],
}

const taxRow = {
  id: 'tx1',
  period: 'QUARTERLY' as const,
  year: 2026,
  quarter: 1,
  month: null,
  grossRevenue: 45000,
  salesTaxCollected: 3600,
  netIncome: 12000,
  estimatedTaxLiability: 4000,
  status: 'FILED' as const,
}

const snapshotRow = {
  id: 'sn1',
  date: new Date('2026-04-01'),
  periodType: 'monthly',
  totalRevenue: 12000,
  totalOrders: 120,
  avgOrderValue: 100,
  totalCOGS: 5000,
  totalExpenses: 2000,
  grossProfit: 7000,
  grossMargin: 58.3,
  netProfit: 5000,
  netMargin: 41.7,
  salesTaxCollected: 960,
  inventoryValue: 30000,
  cashOnHand: null,
}

const fullData: FinancialData = {
  revenueExpenseTrend: [{ bucket: '2026-04', revenue: 12000, expenses: 2000 }],
  marginTrend: [{ bucket: '2026-04', value: 58.3 }],
  taxSummary: [taxRow],
  periodGrid: [snapshotRow],
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('FinancialTab', () => {
  it('renders the section heading', () => {
    render(<FinancialTab data={emptyData} range="30d" />)
    expect(screen.getByText('Financial Overview')).toBeTruthy()
  })

  it('renders ExportButton with tab=financial and correct range', () => {
    render(<FinancialTab data={emptyData} range="year" />)
    const btn = screen.getByTestId('export-btn')
    expect(btn.getAttribute('data-tab')).toBe('financial')
    expect(btn.getAttribute('data-range')).toBe('year')
  })

  it('renders Revenue vs Expenses chart heading', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    expect(screen.getByText('Revenue vs Expenses')).toBeTruthy()
  })

  it('renders Gross Margin Trend chart heading', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    expect(screen.getByText('Gross Margin Trend')).toBeTruthy()
  })

  it('renders area chart when trend data is non-empty', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    expect(screen.getByTestId('area-chart')).toBeTruthy()
  })

  it('renders line chart for margin trend when data is non-empty', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    expect(screen.getByTestId('line-chart')).toBeTruthy()
  })

  it('renders tax summary table when records present', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    expect(screen.getByTestId('tax-summary-table')).toBeTruthy()
  })

  it('shows empty state for tax when no records', () => {
    render(<FinancialTab data={emptyData} range="30d" />)
    expect(screen.getByText(/no tax records found/i)).toBeTruthy()
  })

  it('displays quarter label correctly (Q1 2026)', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    expect(screen.getByText('Q1 2026')).toBeTruthy()
  })

  it('renders FILED status pill', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    expect(screen.getByText('FILED')).toBeTruthy()
  })

  it('renders gross revenue in tax table', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    // $45,000 gross revenue
    expect(screen.getByText('$45,000')).toBeTruthy()
  })

  it('renders tax collected in tax table', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    expect(screen.getByText('$3,600')).toBeTruthy()
  })

  it('renders P&L Grid heading', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    expect(screen.getByText(/12-Month P&L Grid/)).toBeTruthy()
  })

  it('renders period grid table with snapshot data', () => {
    render(<FinancialTab data={fullData} range="30d" />)
    // PeriodGridTable renders the period row with isoMonth format 2026-04
    expect(screen.getByText(/2026-04/)).toBeTruthy()
  })

  it('renders period grid skeleton when periodGrid is empty', () => {
    render(<FinancialTab data={emptyData} range="30d" />)
    expect(screen.getByText(/no period data/i)).toBeTruthy()
  })

  it('renders CALCULATED pill with amber colour class', () => {
    const calcData: FinancialData = {
      ...fullData,
      taxSummary: [{ ...taxRow, id: 'tx2', status: 'CALCULATED' as const }],
    }
    render(<FinancialTab data={calcData} range="30d" />)
    const pill = screen.getByText('CALCULATED')
    expect(pill.className).toContain('amber')
  })

  it('renders Annual period label for YEARLY period', () => {
    const annualData: FinancialData = {
      ...fullData,
      taxSummary: [
        {
          ...taxRow,
          id: 'tx3',
          period: 'YEARLY' as const,
          quarter: null,
          month: null,
          year: 2025,
        },
      ],
    }
    render(<FinancialTab data={annualData} range="year" />)
    expect(screen.getByText('Annual 2025')).toBeTruthy()
  })

  it('renders Monthly period label (May 2026)', () => {
    const monthlyData: FinancialData = {
      ...fullData,
      taxSummary: [
        {
          ...taxRow,
          id: 'tx4',
          period: 'MONTHLY' as const,
          quarter: null,
          month: 5,
          year: 2026,
        },
      ],
    }
    render(<FinancialTab data={monthlyData} range="30d" />)
    expect(screen.getByText('May 2026')).toBeTruthy()
  })
})
