// tests/unit/components/admin/analytics/charts/OrderStatusDonut.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => null,
  Legend: () => null,
}))

import { OrderStatusDonut } from '@/components/admin/analytics/charts/OrderStatusDonut'

describe('OrderStatusDonut', () => {
  it('renders empty state when data is empty', () => {
    render(<OrderStatusDonut data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders pie + cells when data present', () => {
    render(<OrderStatusDonut data={[{ status: 'DELIVERED', count: 3 }, { status: 'SHIPPED', count: 1 }]} />)
    expect(screen.getByTestId('pie-chart')).toBeTruthy()
    expect(screen.getAllByTestId('cell')).toHaveLength(2)
  })
})
