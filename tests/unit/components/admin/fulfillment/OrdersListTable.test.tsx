// tests/unit/components/admin/fulfillment/OrdersListTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrdersListTable } from '@/components/admin/fulfillment/OrdersListTable'
import type { OrderRow } from '@/lib/admin/fulfillment'

const rows: OrderRow[] = [
  {
    id: 'o1',
    orderNumber: 'HOF-0001',
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    totalAmount: 49.99,
    createdAt: new Date('2026-05-01T12:00:00Z'),
    trackingNumber: null,
    carrier: null,
    itemCount: 2,
  },
  {
    id: 'o2',
    orderNumber: 'HOF-0002',
    customerName: null,
    customerEmail: 'guest@example.com',
    status: 'SHIPPED',
    paymentStatus: 'PAID',
    totalAmount: 100,
    createdAt: new Date('2026-05-02T12:00:00Z'),
    trackingNumber: '1Z999AA10123456784',
    carrier: 'UPS',
    itemCount: 1,
  },
]

describe('OrdersListTable', () => {
  it('renders each order row', () => {
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={() => {}} onOpenInspector={() => {}} />)
    expect(screen.getByText('HOF-0001')).toBeInTheDocument()
    expect(screen.getByText('HOF-0002')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('guest@example.com')).toBeInTheDocument()
  })

  it('shows status + payment pills', () => {
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={() => {}} onOpenInspector={() => {}} />)
    expect(screen.getByText('PROCESSING')).toBeInTheDocument()
    expect(screen.getByText('SHIPPED')).toBeInTheDocument()
    expect(screen.getAllByText('PAID')).toHaveLength(2)
  })

  it('fires onSelect on checkbox toggle', () => {
    const onSelect = vi.fn()
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={onSelect} onOpenInspector={() => {}} />)
    const checkboxes = screen.getAllByRole('checkbox')
    // First checkbox is the header select-all; the rest are per-row
    fireEvent.click(checkboxes[1])
    expect(onSelect).toHaveBeenCalledWith('o1', true)
  })

  it('fires onOpenInspector on row action button click', () => {
    const onOpen = vi.fn()
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={() => {}} onOpenInspector={onOpen} />)
    const buttons = screen.getAllByLabelText(/open inspector/i)
    fireEvent.click(buttons[0])
    expect(onOpen).toHaveBeenCalledWith('o1')
  })

  it('renders empty state', () => {
    render(<OrdersListTable rows={[]} selected={new Set()} onSelect={() => {}} onOpenInspector={() => {}} />)
    expect(screen.getByText(/no orders/i)).toBeInTheDocument()
  })

  it('header checkbox selects all', () => {
    const onSelectAll = vi.fn()
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={() => {}} onSelectAll={onSelectAll} onOpenInspector={() => {}} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(onSelectAll).toHaveBeenCalledWith(true)
  })
})
