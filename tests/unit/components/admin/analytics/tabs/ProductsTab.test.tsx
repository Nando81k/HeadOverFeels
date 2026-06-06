import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/components/admin/analytics/charts/TopProductsBar', () => ({
  TopProductsBar: () => <div data-testid="chart-top" />,
}))
vi.mock('@/components/admin/analytics/charts/MarginScatter', () => ({
  MarginScatter: () => <div data-testid="chart-margin-scatter" />,
}))
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))
const getProductFinancialDetailForInspector = vi.fn()
vi.mock('@/app/admin/analytics/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/analytics/actions')
  return {
    ...actual,
    getProductFinancialDetailForInspector: (...a: unknown[]) => getProductFinancialDetailForInspector(...a),
  }
})
vi.mock('@/components/admin/analytics/inspectors/ProductInspector', () => ({
  ProductInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="product-inspector-open" /> : null,
}))

import { ProductsTab } from '@/components/admin/analytics/tabs/ProductsTab'

const data = {
  topProducts: [],
  marginScatter: [],
  table: {
    items: [
      { id: 'p1', name: 'Tee', unitsSold: 5, revenue: 125, cost: 25,
        grossMargin: 100, marginPct: 80, imageUrl: null },
    ],
    total: 1, page: 1, pageSize: 25,
  },
}

describe('ProductsTab', () => {
  it('renders charts + table', () => {
    render(<ProductsTab data={data} range="30d" />)
    expect(screen.getByTestId('chart-top')).toBeTruthy()
    expect(screen.getByTestId('chart-margin-scatter')).toBeTruthy()
    expect(screen.getByText(/Tee/)).toBeTruthy()
  })
  it('opens ProductInspector on row click', async () => {
    getProductFinancialDetailForInspector.mockResolvedValue({
      id: 'p1', name: 'Tee', imageUrl: null, basePrice: 25,
      unitsSold: 5, revenue: 125, cost: 25, grossMargin: 100, marginPct: 80,
      rangeStart: new Date(), rangeEnd: new Date(),
    })
    render(<ProductsTab data={data} range="30d" />)
    fireEvent.click(screen.getByText(/Tee/))
    await waitFor(() => expect(screen.queryByTestId('product-inspector-open')).toBeTruthy())
  })
})
