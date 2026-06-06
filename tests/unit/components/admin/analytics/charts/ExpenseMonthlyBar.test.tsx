// tests/unit/components/admin/analytics/charts/ExpenseMonthlyBar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

import { ExpenseMonthlyBar } from '@/components/admin/analytics/charts/ExpenseMonthlyBar'

describe('ExpenseMonthlyBar', () => {
  it('empty state', () => {
    render(<ExpenseMonthlyBar data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders bar chart', () => {
    render(<ExpenseMonthlyBar data={[{ month: '2026-05', amount: 1200 }]} />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
    expect(screen.getByTestId('bar')).toBeTruthy()
  })
})
