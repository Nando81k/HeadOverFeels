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

import { PointsActivityChart } from '@/components/admin/loyalty/charts/PointsActivityChart'

describe('PointsActivityChart', () => {
  it('renders empty state when data is empty', () => {
    render(<PointsActivityChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders 2 lines when data is present', () => {
    render(<PointsActivityChart data={[{ bucket: '2026-05-30', earned: 100, redeemed: 30 }]} />)
    expect(screen.getByTestId('line-chart')).toBeTruthy()
    expect(screen.getAllByTestId('line')).toHaveLength(2)
  })

  it('renders loading state when loading is true', () => {
    render(<PointsActivityChart data={[]} loading />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })

  it('renders chart wrapper with responsive container when data is present', () => {
    render(<PointsActivityChart data={[{ bucket: '2026-05-01', earned: 200, redeemed: 50 }]} />)
    expect(screen.getByTestId('responsive-container')).toBeTruthy()
  })
})
