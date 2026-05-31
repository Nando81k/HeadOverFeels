// tests/unit/components/admin/dashboard/LiveActivityFeed.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LiveActivityFeed } from '@/components/admin/dashboard/LiveActivityFeed'
import type { ActivityItem } from '@/lib/admin/dashboard'

vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), off: vi.fn(), disconnect: vi.fn(), emit: vi.fn() }),
}))

const items: ActivityItem[] = [
  { id: '1', type: 'order', status: 'success', title: 'Order #3492', description: 'AJ1 × 1', value: '$179', timestamp: '2m ago', href: '/admin/orders/1' },
  { id: '2', type: 'drop-sale', status: 'live', title: 'Drop sale', description: 'Cactus × 1', value: '$220', timestamp: '11m ago', href: '/admin/orders/2' },
]

describe('LiveActivityFeed', () => {
  it('renders initial items', () => {
    render(<LiveActivityFeed initialItems={items} />)
    expect(screen.getByText('Live activity')).toBeInTheDocument()
    expect(screen.getByText('Order #3492')).toBeInTheDocument()
    expect(screen.getByText('Drop sale')).toBeInTheDocument()
  })

  it('renders View all link', () => {
    render(<LiveActivityFeed initialItems={items} />)
    const link = screen.getByRole('link', { name: /view all/i })
    expect(link).toHaveAttribute('href', '/admin/orders')
  })

  it('renders empty state when no items', () => {
    render(<LiveActivityFeed initialItems={[]} />)
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument()
  })
})
