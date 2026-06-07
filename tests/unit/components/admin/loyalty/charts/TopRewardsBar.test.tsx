// tests/unit/components/admin/loyalty/charts/TopRewardsBar.test.tsx
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

import { TopRewardsBar } from '@/components/admin/loyalty/charts/TopRewardsBar'

describe('TopRewardsBar', () => {
  it('empty state', () => {
    render(<TopRewardsBar data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders horizontal bar chart with data', () => {
    render(<TopRewardsBar data={[{ rewardId: 'r1', name: '10% off', totalRedeemed: 25 }]} />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
    expect(screen.getByTestId('bar')).toBeTruthy()
  })
})
