// tests/unit/components/admin/loyalty/charts/MemberGrowthChart.test.tsx
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
}))

import { MemberGrowthChart } from '@/components/admin/loyalty/charts/MemberGrowthChart'

describe('MemberGrowthChart', () => {
  it('empty state', () => {
    render(<MemberGrowthChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders area when data present', () => {
    render(<MemberGrowthChart data={[{ bucket: '2026-05-30', newMembers: 3 }]} />)
    expect(screen.getByTestId('area-chart')).toBeTruthy()
    expect(screen.getByTestId('area')).toBeTruthy()
  })
})
