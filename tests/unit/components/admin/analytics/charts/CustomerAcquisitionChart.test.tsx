// tests/unit/components/admin/analytics/charts/CustomerAcquisitionChart.test.tsx
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

import { CustomerAcquisitionChart } from '@/components/admin/analytics/charts/CustomerAcquisitionChart'

describe('CustomerAcquisitionChart', () => {
  it('renders empty state when data is empty', () => {
    render(<CustomerAcquisitionChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders two stacked areas when data present', () => {
    render(<CustomerAcquisitionChart data={[{ bucket: '2026-05', newCustomers: 5, returningCustomers: 3 }]} />)
    expect(screen.getByTestId('area-chart')).toBeTruthy()
    expect(screen.getAllByTestId('area')).toHaveLength(2)
  })
})
