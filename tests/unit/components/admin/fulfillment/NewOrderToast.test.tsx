// tests/unit/components/admin/fulfillment/NewOrderToast.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { NewOrderToast } from '@/components/admin/fulfillment/NewOrderToast'

const handlers: Record<string, ((p: unknown) => void) | undefined> = {}
const socketMock = {
  on: vi.fn((evt: string, fn: (p: unknown) => void) => {
    handlers[evt] = fn
  }),
  off: vi.fn(),
  disconnect: vi.fn(),
}
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketMock),
}))

const toastInfo = vi.fn()
vi.mock('@/lib/toast', () => ({
  toast: { info: (...a: unknown[]) => toastInfo(...a), success: vi.fn(), error: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(handlers)) delete handlers[k]
})

describe('NewOrderToast', () => {
  it('subscribes to order:new on mount', () => {
    render(<NewOrderToast />)
    expect(socketMock.on).toHaveBeenCalledWith('order:new', expect.any(Function))
  })

  it('shows a toast on order:new', () => {
    render(<NewOrderToast />)
    act(() => {
      handlers['order:new']?.({ id: 'o1', orderNumber: 'HOF-1', total: 49.99, customerEmail: 'x@e.com' })
    })
    expect(toastInfo).toHaveBeenCalled()
  })

  it('debounces duplicate events for the same id within 5s', () => {
    render(<NewOrderToast />)
    act(() => {
      handlers['order:new']?.({ id: 'o1', orderNumber: 'HOF-1', total: 49, customerEmail: 'x@e.com' })
      handlers['order:new']?.({ id: 'o1', orderNumber: 'HOF-1', total: 49, customerEmail: 'x@e.com' })
    })
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it('disconnects on unmount', () => {
    const { unmount } = render(<NewOrderToast />)
    unmount()
    expect(socketMock.disconnect).toHaveBeenCalled()
  })
})
