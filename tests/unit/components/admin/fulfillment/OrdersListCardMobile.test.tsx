// tests/unit/components/admin/fulfillment/OrdersListCardMobile.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrdersListCardMobile } from '@/components/admin/fulfillment/OrdersListCardMobile'
import type { OrderRow } from '@/lib/admin/fulfillment'

vi.mock('@/components/ui/SwipeableRow', () => ({
  SwipeableRow: ({
    children,
    rightActions,
  }: {
    children: React.ReactNode
    rightActions?: Array<{ onClick: () => void; label: string }>
  }) => (
    <div>
      {rightActions?.map((action, i) => (
        <button key={i} type="button" onClick={action.onClick} data-testid="swipe-action">
          {action.label}
        </button>
      ))}
      {children}
    </div>
  ),
}))

const row: OrderRow = {
  id: 'o1',
  orderNumber: 'HOF-0001',
  customerName: 'Ada',
  customerEmail: 'ada@example.com',
  status: 'PROCESSING',
  paymentStatus: 'PAID',
  totalAmount: 49.99,
  createdAt: new Date('2026-05-01T12:00:00Z'),
  trackingNumber: null,
  carrier: null,
  itemCount: 2,
}

describe('OrdersListCardMobile', () => {
  it('renders order number, customer, total, item count', () => {
    render(<OrdersListCardMobile row={row} selected={false} onLongPress={() => {}} onEdit={() => {}} onMarkShipped={() => {}} />)
    expect(screen.getByText('HOF-0001')).toBeInTheDocument()
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText(/\$49\.99/)).toBeInTheDocument()
    expect(screen.getByText(/2 items?/i)).toBeInTheDocument()
  })

  it('fires onLongPress via contextmenu (right-click)', () => {
    const onLong = vi.fn()
    render(<OrdersListCardMobile row={row} selected={false} onLongPress={onLong} onEdit={() => {}} onMarkShipped={() => {}} />)
    fireEvent.contextMenu(screen.getByText('HOF-0001').closest('article')!)
    expect(onLong).toHaveBeenCalledWith('o1')
  })

  it('fires onEdit on Edit button click', () => {
    const onEdit = vi.fn()
    render(<OrdersListCardMobile row={row} selected={false} onLongPress={() => {}} onEdit={onEdit} onMarkShipped={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith('o1')
  })

  it('shows selected state visually', () => {
    const { container } = render(<OrdersListCardMobile row={row} selected={true} onLongPress={() => {}} onEdit={() => {}} onMarkShipped={() => {}} />)
    const card = container.querySelector('article')
    expect(card?.className).toMatch(/ring|border-(emerald|blue|sky|indigo)/)
  })

  it('fires onMarkShipped via swipe action', () => {
    const onShipped = vi.fn()
    render(<OrdersListCardMobile row={row} selected={false} onLongPress={() => {}} onEdit={() => {}} onMarkShipped={onShipped} />)
    fireEvent.click(screen.getByTestId('swipe-action'))
    expect(onShipped).toHaveBeenCalledWith('o1')
  })
})
