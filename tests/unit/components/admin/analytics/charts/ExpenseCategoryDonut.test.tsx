// tests/unit/components/admin/analytics/charts/ExpenseCategoryDonut.test.tsx
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

import { ExpenseCategoryDonut } from '@/components/admin/analytics/charts/ExpenseCategoryDonut'

describe('ExpenseCategoryDonut', () => {
  it('empty state', () => {
    render(<ExpenseCategoryDonut data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders pie with one cell per slice', () => {
    render(<ExpenseCategoryDonut data={[
      { categoryId: 'cat1', categoryName: 'Marketing', color: '#FF3131', amount: 500 },
      { categoryId: 'cat2', categoryName: 'Hosting', color: '#6366f1', amount: 100 },
    ]} />)
    expect(screen.getAllByTestId('cell')).toHaveLength(2)
  })
})
