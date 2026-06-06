// tests/unit/components/admin/analytics/tabs/OverviewTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/admin/analytics/charts/RevenueTrendChart', () => ({
  RevenueTrendChart: () => <div data-testid="chart-revenue-trend" />,
}))
vi.mock('@/components/admin/analytics/charts/OrdersBarChart', () => ({
  OrdersBarChart: () => <div data-testid="chart-orders-bar" />,
}))
vi.mock('@/components/admin/analytics/charts/CustomerAcquisitionChart', () => ({
  CustomerAcquisitionChart: () => <div data-testid="chart-acq" />,
}))
vi.mock('@/components/admin/analytics/charts/OrderStatusDonut', () => ({
  OrderStatusDonut: () => <div data-testid="chart-status-donut" />,
}))
vi.mock('@/components/admin/analytics/inspectors/GoalsInspector', () => ({
  GoalsInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="goals-inspector-open" /> : null,
}))
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { OverviewTab } from '@/components/admin/analytics/tabs/OverviewTab'

const data = {
  revenueTrend: [{ bucket: '2026-05-30', value: 100 }],
  ordersTrend: [{ bucket: '2026-05-30', value: 1 }],
  acquisitionTrend: [{ bucket: '2026-05', newCustomers: 1, returningCustomers: 0 }],
  statusDonut: [{ status: 'DELIVERED', count: 1 }],
  goals: {
    id: 'default',
    dailyTarget: 500,
    weeklyTarget: 3500,
    monthlyTarget: 15000,
    quarterlyTarget: 45000,
    yearlyTarget: 180000,
    updatedAt: new Date('2026-05-01'),
  },
}

describe('OverviewTab', () => {
  it('renders 4 charts + goals card + export', () => {
    render(<OverviewTab data={data} range="30d" />)
    expect(screen.getByTestId('chart-revenue-trend')).toBeTruthy()
    expect(screen.getByTestId('chart-orders-bar')).toBeTruthy()
    expect(screen.getByTestId('chart-acq')).toBeTruthy()
    expect(screen.getByTestId('chart-status-donut')).toBeTruthy()
    expect(screen.getByText(/edit goals/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
  })

  it('opens GoalsInspector when Edit goals clicked', () => {
    render(<OverviewTab data={data} range="30d" />)
    fireEvent.click(screen.getByText(/edit goals/i))
    expect(screen.getByTestId('goals-inspector-open')).toBeTruthy()
  })
})
