// tests/unit/components/admin/analytics/charts/MarginTrendChart.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

import { MarginTrendChart } from '@/components/admin/analytics/charts/MarginTrendChart'

describe('MarginTrendChart', () => {
  it('empty state', () => {
    render(<MarginTrendChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders line chart', () => {
    render(<MarginTrendChart data={[{ bucket: '2026-05', value: 55 }]} />)
    expect(screen.getByTestId('line-chart')).toBeTruthy()
    expect(screen.getByTestId('line')).toBeTruthy()
  })

  it('renders loading state', () => {
    render(<MarginTrendChart data={[]} loading />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })
})
