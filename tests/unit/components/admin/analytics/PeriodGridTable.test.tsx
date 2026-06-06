// tests/unit/components/admin/analytics/PeriodGridTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PeriodGridTable } from '@/components/admin/analytics/PeriodGridTable'

describe('PeriodGridTable', () => {
  it('renders empty state when no rows', () => {
    render(<PeriodGridTable rows={[]} />)
    expect(screen.getByText(/no period data/i)).toBeTruthy()
  })

  it('renders skeleton when rows is null (loading)', () => {
    render(<PeriodGridTable rows={null} />)
    expect(screen.getByTestId('period-grid-skeleton')).toBeTruthy()
  })

  it('renders one row per snapshot', () => {
    render(
      <PeriodGridTable
        rows={[
          {
            id: 's1',
            date: new Date('2026-04-01'),
            periodType: 'monthly',
            totalRevenue: 10000,
            totalOrders: 100,
            avgOrderValue: 100,
            totalCOGS: 4000,
            totalExpenses: 2000,
            grossProfit: 6000,
            grossMargin: 60,
            netProfit: 4000,
            netMargin: 40,
            salesTaxCollected: 800,
            inventoryValue: 0,
            cashOnHand: null,
          },
        ]}
      />
    )
    expect(screen.getByText(/2026-04/)).toBeTruthy()
  })

  it('shows dash for zero-value cells', () => {
    render(
      <PeriodGridTable
        rows={[
          {
            id: 's2',
            date: new Date('2026-03-01'),
            periodType: 'monthly',
            totalRevenue: 0,
            totalOrders: 0,
            avgOrderValue: 0,
            totalCOGS: 0,
            totalExpenses: 0,
            grossProfit: 0,
            grossMargin: 0,
            netProfit: 0,
            netMargin: 0,
            salesTaxCollected: 0,
            inventoryValue: 0,
            cashOnHand: null,
          },
        ]}
      />
    )
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders table headers', () => {
    render(<PeriodGridTable rows={[]} />)
    // empty state renders, no headers — ensure no crash
    expect(screen.getByText(/no period data/i)).toBeTruthy()
  })

  it('renders headers when rows are present', () => {
    render(
      <PeriodGridTable
        rows={[
          {
            id: 's3',
            date: new Date('2026-05-01'),
            periodType: 'monthly',
            totalRevenue: 5000,
            totalOrders: 50,
            avgOrderValue: 100,
            totalCOGS: 2000,
            totalExpenses: 1000,
            grossProfit: 3000,
            grossMargin: 60,
            netProfit: 2000,
            netMargin: 40,
            salesTaxCollected: 400,
            inventoryValue: 0,
            cashOnHand: null,
          },
        ]}
      />
    )
    expect(screen.getByText('Revenue')).toBeTruthy()
    expect(screen.getByText('COGS')).toBeTruthy()
    expect(screen.getByText('Gross Profit')).toBeTruthy()
    expect(screen.getByText('Expenses')).toBeTruthy()
    expect(screen.getByText('Net Profit')).toBeTruthy()
    expect(screen.getByText('Margin %')).toBeTruthy()
  })
})
