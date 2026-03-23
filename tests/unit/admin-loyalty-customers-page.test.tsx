import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoyaltyCustomersPage from '@/app/admin/loyalty/customers/page'

const { fetchMock, toastMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
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

vi.mock('@/components/admin/LoyaltyNav', () => ({
  LoyaltyNav: () => <div data-testid="loyalty-nav" />,
}))

vi.mock('@/lib/toast', () => ({
  toast: toastMock,
}))

describe('Admin loyalty customers page', () => {
  beforeEach(() => {
    vi.useRealTimers()
    fetchMock.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/admin/loyalty/customers?')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'cust-1',
                name: 'Alice',
                email: 'alice@example.com',
                currentPoints: 200,
                lifetimePoints: 500,
                annualPointsEarned: 220,
                totalSpent: 300,
                tier: { id: 'tier-1', name: 'Mind' },
                orderCount: 2,
                createdAt: '2026-03-20T00:00:00.000Z',
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, pages: 1 },
            tiers: [{ id: 'tier-1', name: 'Mind' }],
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

  it('loads loyalty customer list from canonical response shape', async () => {
    render(<LoyaltyCustomersPage />)

    await screen.findAllByText('alice@example.com')
    expect(screen.getByText('1 loyalty customers')).toBeTruthy()
  })

  it('calls canonical loyalty action route for points adjustments', async () => {
    render(<LoyaltyCustomersPage />)
    await screen.findAllByText('alice@example.com')

    fireEvent.click(screen.getAllByRole('button', { name: /Points/i })[0])
    fireEvent.change(screen.getByPlaceholderText('Use positive or negative points'), {
      target: { value: '25' },
    })
    fireEvent.change(screen.getByPlaceholderText('Reason'), {
      target: { value: 'QA adjustment' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => String(url) === '/api/admin/loyalty/customers' && init?.method === 'POST'
        )
      ).toBe(true)
    })
  })
})
