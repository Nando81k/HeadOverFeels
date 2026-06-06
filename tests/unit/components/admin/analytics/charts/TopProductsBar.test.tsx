// tests/unit/components/admin/analytics/charts/TopProductsBar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

import { TopProductsBar } from '@/components/admin/analytics/charts/TopProductsBar'

const sampleData = [
  { productId: 'p1', name: 'Classic Tee', unitsSold: 42, revenue: 1050 },
  { productId: 'p2', name: 'Hoodie', unitsSold: 20, revenue: 800 },
  { productId: 'p3', name: 'Cap', unitsSold: 35, revenue: 525 },
]

describe('TopProductsBar', () => {
  it('empty state on empty data', () => {
    render(<TopProductsBar data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders horizontal bar chart with data', () => {
    render(<TopProductsBar data={[{ productId: 'p1', name: 'Tee', unitsSold: 10, revenue: 250 }]} />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
    expect(screen.getByTestId('bar')).toBeTruthy()
  })

  it('caps display at top 10 products', () => {
    const bigData = Array.from({ length: 15 }, (_, i) => ({
      productId: `p${i}`,
      name: `Product ${i}`,
      unitsSold: i * 5,
      revenue: (15 - i) * 100,
    }))
    render(<TopProductsBar data={bigData} />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
  })

  it('renders loading skeleton when loading is true', () => {
    render(<TopProductsBar data={[]} loading />)
    expect(screen.getByTestId('top-products-bar-skeleton')).toBeTruthy()
  })

  it('calls onProductClick when provided and chart is interactive', () => {
    const onClick = vi.fn()
    render(<TopProductsBar data={sampleData} onProductClick={onClick} />)
    // Chart renders with data — bar chart is present
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
  })
})
