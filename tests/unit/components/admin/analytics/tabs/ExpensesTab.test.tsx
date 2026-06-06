import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/admin/analytics/charts/ExpenseCategoryDonut', () => ({
  ExpenseCategoryDonut: () => <div data-testid="chart-cat-donut" />,
}))
vi.mock('@/components/admin/analytics/charts/ExpenseMonthlyBar', () => ({
  ExpenseMonthlyBar: () => <div data-testid="chart-monthly-bar" />,
}))
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))
const getExpenseDetailForInspector = vi.fn()
vi.mock('@/app/admin/analytics/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/analytics/actions')
  return { ...actual, getExpenseDetailForInspector: (...a: unknown[]) => getExpenseDetailForInspector(...a) }
})
vi.mock('@/components/admin/analytics/inspectors/ExpenseInspector', () => ({
  ExpenseInspector: ({ open, createMode }: { open: boolean; createMode?: boolean }) =>
    open ? <div data-testid={createMode ? 'inspector-create' : 'inspector-edit'} /> : null,
}))

import { ExpensesTab } from '@/components/admin/analytics/tabs/ExpensesTab'

const data = {
  categoryBreakdown: [],
  monthlyBars: [],
  table: {
    items: [
      {
        id: 'e1',
        amount: 100,
        date: new Date('2026-05-15'),
        description: 'FB ads',
        vendor: 'Meta',
        categoryId: 'cat1',
        categoryName: 'Marketing',
        categoryColor: '#FF3131',
        isTaxDeductible: true,
        status: 'PAID' as const,
        paymentMethod: 'card',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 25,
  },
}
const categories = [{ id: 'cat1', name: 'Marketing', color: '#FF3131' }]

describe('ExpensesTab', () => {
  it('renders charts + new expense button + table', () => {
    render(<ExpensesTab data={data} range="30d" categories={categories} isSuperAdmin={false} />)
    expect(screen.getByTestId('chart-cat-donut')).toBeTruthy()
    expect(screen.getByTestId('chart-monthly-bar')).toBeTruthy()
    expect(screen.getByRole('button', { name: /new expense/i })).toBeTruthy()
    expect(screen.getByText(/FB ads/)).toBeTruthy()
  })

  it('opens create inspector on New Expense click', () => {
    render(<ExpensesTab data={data} range="30d" categories={categories} isSuperAdmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: /new expense/i }))
    expect(screen.getByTestId('inspector-create')).toBeTruthy()
  })
})
