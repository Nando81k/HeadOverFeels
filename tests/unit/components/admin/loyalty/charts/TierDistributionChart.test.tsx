import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children }: { children?: React.ReactNode }) => <div data-testid="bar">{children}</div>,
  LabelList: () => <div data-testid="labellist" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

import { TierDistributionChart } from '@/components/admin/loyalty/charts/TierDistributionChart'

describe('TierDistributionChart', () => {
  it('renders empty state on empty data', () => {
    render(<TierDistributionChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders chart when data present', () => {
    render(<TierDistributionChart data={[
      { tierId: 't1', tierName: 'Bronze', count: 30, percent: 75 },
      { tierId: 't2', tierName: 'Silver', count: 10, percent: 25 },
    ]} />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
    expect(screen.getByTestId('bar')).toBeTruthy()
  })
  it('renders loading skeleton when loading prop is true', () => {
    render(<TierDistributionChart data={[]} loading />)
    expect(screen.getByTestId('tier-distribution-chart-skeleton')).toBeTruthy()
  })
})
