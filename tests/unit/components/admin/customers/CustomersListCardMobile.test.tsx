// tests/unit/components/admin/customers/CustomersListCardMobile.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { CustomersListCardMobile } from '@/components/admin/customers/CustomersListCardMobile'
import type { CustomerRow } from '@/lib/admin/customers'

const row: CustomerRow = {
  id: 'c1', email: 'ada@e.com', name: 'Ada',
  tierId: 't1', tierName: 'Silver', tierColor: '#aaa',
  currentPoints: 250, totalOrders: 3, totalSpent: 450,
  lastOrderDate: new Date('2026-05-20'), createdAt: new Date('2026-01-15'),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

describe('CustomersListCardMobile', () => {
  it('tap navigates when nothing is selected', () => {
    render(
      <CustomersListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        isSuperAdmin={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open ada@e\.com/i }))
    expect(pushMock).toHaveBeenCalledWith('/admin/customers/c1')
  })

  it('tap toggles selection when other rows are selected', () => {
    const onToggle = vi.fn()
    render(
      <CustomersListCardMobile
        row={row}
        selectedIds={new Set(['otherId'])}
        onToggleSelection={onToggle}
        isSuperAdmin={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open ada@e\.com/i }))
    expect(onToggle).toHaveBeenCalledWith('c1')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('long press enters multi-select on this card', () => {
    const onToggle = vi.fn()
    render(
      <CustomersListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={onToggle}
        isSuperAdmin={false}
      />,
    )
    const btn = screen.getByRole('button', { name: /open ada@e\.com/i })
    fireEvent.touchStart(btn, { touches: [{ clientX: 0, clientY: 0 }] })
    act(() => { vi.advanceTimersByTime(550) })
    fireEvent.touchEnd(btn)
    expect(onToggle).toHaveBeenCalledWith('c1')
  })

  it('renders Gift action only when isSuperAdmin is true + swipe threshold exceeded', () => {
    const onGift = vi.fn()
    render(
      <CustomersListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        isSuperAdmin
        onGiftPoints={onGift}
      />,
    )
    const btn = screen.getByRole('button', { name: /open ada@e\.com/i })
    fireEvent.touchStart(btn, { touches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.touchMove(btn, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchEnd(btn)
    const giftBtn = screen.getByRole('button', { name: /gift/i })
    fireEvent.click(giftBtn)
    expect(onGift).toHaveBeenCalledWith('c1')
  })
})
