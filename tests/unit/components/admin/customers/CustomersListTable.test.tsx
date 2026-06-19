// tests/unit/components/admin/customers/CustomersListTable.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { CustomersListTable } from '@/components/admin/customers/CustomersListTable'
import type { CustomerRow } from '@/lib/admin/customers'

const sampleRow: CustomerRow = {
  id: 'c1', email: 'ada@e.com', name: 'Ada',
  tierId: 't1', tierName: 'Silver', tierColor: '#aaa',
  currentPoints: 250, totalOrders: 3, totalSpent: 450,
  lastOrderDate: new Date('2026-05-20'), createdAt: new Date('2026-01-15'),
}

beforeEach(() => vi.clearAllMocks())

describe('CustomersListTable', () => {
  it('renders email + tier name + totals for each row', () => {
    render(
      <CustomersListTable
        rows={[sampleRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.getByText('ada@e.com')).toBeTruthy()
    expect(screen.getByText('Silver')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('row click navigates to detail page', () => {
    render(
      <CustomersListTable
        rows={[sampleRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open ada@e\.com/i }))
    expect(pushMock).toHaveBeenCalledWith('/admin/customers/c1')
  })

  it('checkbox click toggles selection without navigating', () => {
    const onToggle = vi.fn()
    render(
      <CustomersListTable
        rows={[sampleRow]}
        selectedIds={new Set()}
        onToggleSelection={onToggle}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /select ada@e\.com/i }))
    expect(onToggle).toHaveBeenCalledWith('c1')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('header checkbox toggles all', () => {
    const onToggleAll = vi.fn()
    render(
      <CustomersListTable
        rows={[sampleRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={onToggleAll}
        allSelected={false}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    expect(onToggleAll).toHaveBeenCalled()
  })

  it('empty state when rows is empty', () => {
    render(
      <CustomersListTable
        rows={[]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.getByText(/no customers/i)).toBeTruthy()
  })
})
