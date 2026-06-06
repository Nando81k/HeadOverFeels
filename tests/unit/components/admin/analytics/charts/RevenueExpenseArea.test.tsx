// tests/unit/components/admin/analytics/charts/RevenueExpenseArea.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

import { RevenueExpenseArea } from '@/components/admin/analytics/charts/RevenueExpenseArea'

describe('RevenueExpenseArea', () => {
  it('empty state', () => {
    render(<RevenueExpenseArea data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders 2 areas', () => {
    render(<RevenueExpenseArea data={[{ bucket: '2026-05', revenue: 1000, expenses: 400 }]} />)
    expect(screen.getAllByTestId('area')).toHaveLength(2)
  })
})
