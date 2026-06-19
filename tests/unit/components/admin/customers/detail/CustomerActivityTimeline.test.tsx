import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerActivity: vi.fn().mockResolvedValue([
    {
      id: 'order-o1',
      type: 'order',
      label: 'Order HOF-100',
      timestamp: new Date('2026-05-15'),
      meta: '$50.00',
    },
    {
      id: 'points-p1',
      type: 'points',
      label: '+100 pts (PURCHASE)',
      timestamp: new Date('2026-05-14'),
      meta: undefined,
    },
  ]),
}))

import { CustomerActivityTimeline } from '@/components/admin/customers/detail/CustomerActivityTimeline'

beforeEach(() => vi.clearAllMocks())

describe('CustomerActivityTimeline', () => {
  it('renders activity events with type icon + label + timestamp', async () => {
    const node = await CustomerActivityTimeline({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/HOF-100/)).toBeTruthy()
    expect(screen.getByText(/\+100 pts/)).toBeTruthy()
  })

  it('renders meta text alongside the label when present', async () => {
    const node = await CustomerActivityTimeline({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/\$50\.00/)).toBeTruthy()
  })

  it('renders empty state when no events', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerActivity as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])
    const node = await CustomerActivityTimeline({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no recent activity/i)).toBeTruthy()
  })
})
