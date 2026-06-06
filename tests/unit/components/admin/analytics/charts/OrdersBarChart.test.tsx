// tests/unit/components/admin/analytics/charts/OrdersBarChart.test.tsx
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

import { OrdersBarChart } from '@/components/admin/analytics/charts/OrdersBarChart'

describe('OrdersBarChart', () => {
  it('renders empty state when data is empty', () => {
    render(<OrdersBarChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders chart when data present', () => {
    render(<OrdersBarChart data={[{ bucket: '2026-05-30', value: 3 }]} />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
    expect(screen.getByTestId('bar')).toBeTruthy()
  })
})
