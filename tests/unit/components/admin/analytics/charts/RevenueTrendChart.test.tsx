// tests/unit/components/admin/analytics/charts/RevenueTrendChart.test.tsx
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
  Legend: () => null,
}))

import { RevenueTrendChart } from '@/components/admin/analytics/charts/RevenueTrendChart'

describe('RevenueTrendChart', () => {
  it('renders empty state when data is empty', () => {
    render(<RevenueTrendChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders chart container when data is present', () => {
    render(<RevenueTrendChart data={[{ bucket: '2026-05-30', value: 100 }]} />)
    expect(screen.getByTestId('line-chart')).toBeTruthy()
    expect(screen.getByTestId('line')).toBeTruthy()
  })
})
