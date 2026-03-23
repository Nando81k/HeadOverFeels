/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminOrdersPage from '@/app/admin/orders/page'

const { fetchMock, toggleMuteMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  toggleMuteMock: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({
    title,
    subtitle,
    children,
    headerActions,
  }: {
    title: string
    subtitle?: string
    children: ReactNode
    headerActions?: ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {headerActions}
      {children}
    </div>
  ),
}))

vi.mock('@/components/admin/OrderMobileCard', () => ({
  OrderMobileCard: ({ order }: { order: { orderNumber: string } }) => <div>{order.orderNumber}</div>,
}))

vi.mock('@/components/ui/DateRangePicker', () => ({
  DateRangePicker: () => <div data-testid="date-range-picker" />,
}))

vi.mock('@/lib/hooks/useOrderPolling', () => ({
  useOrderPolling: () => ({
    newOrderCount: 0,
    isMuted: false,
    toggleMute: toggleMuteMock,
    clearNewOrderCount: vi.fn(),
    isPolling: true,
    lastChecked: new Date('2026-03-21T10:00:00.000Z'),
  }),
}))

vi.mock('@/lib/toast', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AdminOrdersPage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/orders?') && (!init || !init.method)) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'ord-1',
                orderNumber: 'HOF-1001',
                status: 'PENDING',
                paymentStatus: 'PAID',
                total: 89,
                createdAt: '2026-03-20T12:00:00.000Z',
                customer: { email: 'alice@example.com' },
                shippingAddress: { firstName: 'Alice', lastName: 'Mills' },
                _count: { items: 2 },
              },
            ],
            pagination: {
              page: 1,
              limit: 20,
              total: 1,
              pages: 1,
            },
          }),
        } as Response
      }

      if (url.startsWith('/api/orders/ord-1') && init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({ data: { id: 'ord-1', status: 'PROCESSING' } }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    })
  })

  it('issues debounced search query params and renders active filter chips', async () => {
    render(<AdminOrdersPage />)

    await screen.findAllByText('HOF-1001')

    fireEvent.change(screen.getByPlaceholderText('Search order number, customer, or email'), {
      target: { value: 'alice' },
    })

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url))
      expect(calls.some((url) => url.includes('/api/orders?') && url.includes('search=alice'))).toBe(true)
    }, { timeout: 2000 })

    expect(screen.getByText('Search')).toBeTruthy()
    expect(screen.getByText('alice')).toBeTruthy()
  })

  it('shows sticky bulk rail when orders are selected', async () => {
    render(<AdminOrdersPage />)
    await screen.findAllByText('HOF-1001')

    fireEvent.click(screen.getByLabelText('Select all orders'))

    expect(screen.getByText(/selected order/i)).toBeTruthy()
    expect(screen.getByText('Bulk status update')).toBeTruthy()
  })
})
