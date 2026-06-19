import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminCustomersV1Page as CustomersPage } from '@/components/admin/_v1/AdminCustomersV1Page'

const { fetchMock, toastMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
  },
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

vi.mock('@/components/customers/CustomerMetricCards', () => ({
  default: () => <div data-testid="metrics-cards" />,
}))
vi.mock('@/components/customers/CustomerSegmentChart', () => ({
  default: () => <div data-testid="segment-chart" />,
}))
vi.mock('@/components/customers/CustomerActivityChart', () => ({
  default: () => <div data-testid="activity-chart" />,
}))
vi.mock('@/components/customers/CustomerRetentionChart', () => ({
  default: () => <div data-testid="retention-chart" />,
}))

vi.mock('@/lib/toast', () => ({
  toast: toastMock,
}))

describe('Admin customers page', () => {
  beforeEach(() => {
    vi.useRealTimers()
    fetchMock.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    toastMock.loading.mockReset()
    toastMock.dismiss.mockReset()
    toastMock.loading.mockReturnValue('toast-id')
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/admin/customers?')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'cust-1',
                name: 'Alice',
                email: 'alice@example.com',
                phone: null,
                totalSpent: 180,
                totalOrders: 3,
                lastOrderDate: '2026-03-20T00:00:00.000Z',
                avgOrderValue: 60,
                createdAt: '2026-01-01T00:00:00.000Z',
                currentPoints: 120,
                lifetimePoints: 200,
                annualPointsEarned: 150,
                segment: 'VIP',
                tier: { id: 'tier-1', name: 'Mind', slug: 'mind' },
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, pages: 1 },
            tiers: [{ id: 'tier-1', name: 'Mind', slug: 'mind' }],
          }),
        } as Response
      }

      if (url === '/api/admin/loyalty/customers' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    })
  })

  it('applies search and segment filters through canonical query params', async () => {
    render(<CustomersPage />)
    await screen.findAllByText('alice@example.com')

    fireEvent.change(screen.getByPlaceholderText('Search customer by name or email'), {
      target: { value: 'alice' },
    })

    await waitFor(
      () => {
        const calls = fetchMock.mock.calls.map(([url]) => String(url))
        expect(calls.some((url) => url.includes('/api/admin/customers?') && url.includes('search=alice'))).toBe(true)
      },
      { timeout: 2000 }
    )

    fireEvent.click(screen.getByRole('button', { name: 'VIP' }))

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url))
      expect(calls.some((url) => url.includes('/api/admin/customers?') && url.includes('segment=VIP'))).toBe(true)
    })
  }, 15000)

  it('runs quick loyalty action via canonical loyalty route', async () => {
    render(<CustomersPage />)
    await screen.findAllByText('alice@example.com')

    fireEvent.click(screen.getByTitle('Gift points'))

    fireEvent.change(screen.getByPlaceholderText('Points amount'), {
      target: { value: '50' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gift Points' }))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => String(url) === '/api/admin/loyalty/customers' && init?.method === 'POST'
        )
      ).toBe(true)
    })
  })
})
