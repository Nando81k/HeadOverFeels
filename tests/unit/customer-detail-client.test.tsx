import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerDetailClient } from '@/components/admin/customer-detail/CustomerDetailClient'

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

vi.mock('@/components/admin/customer-detail/CustomerSpendingChart', () => ({
  default: () => <div data-testid="spending-chart" />,
}))
vi.mock('@/components/admin/customer-detail/CarePointsActivityChart', () => ({
  default: () => <div data-testid="points-chart" />,
}))
vi.mock('@/components/admin/customer-detail/CarePointsSummaryCard', () => ({
  default: () => <div data-testid="points-summary" />,
}))
vi.mock('@/components/admin/customer-detail/PointsHistoryTable', () => ({
  default: () => <div data-testid="points-history" />,
}))
vi.mock('@/components/admin/customer-detail/PurchaseHistoryTable', () => ({
  default: () => <div data-testid="purchase-history" />,
}))
vi.mock('@/components/admin/customer-detail/GiftPointsModal', () => ({
  default: () => null,
}))

vi.mock('@/lib/toast', () => ({
  toast: toastMock,
}))

function buildCustomerPayload() {
  return {
    customer: {
      id: 'customer-1',
      email: 'alice@example.com',
      name: 'Alice',
      phone: '111-111-1111',
      birthday: '2020-02-02T00:00:00.000Z',
      newsletter: true,
      smsOptIn: false,
      isAdmin: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      totalSpent: 320,
      totalOrders: 4,
      avgOrderValue: 80,
      lastOrderDate: '2026-03-20T00:00:00.000Z',
      currentPoints: 100,
      lifetimePoints: 220,
      annualPointsEarned: 120,
      currentTier: null,
      nextTier: null,
      expiringPoints: 0,
      expiringDate: null,
    },
    orders: [],
    pointsTransactions: [],
    notes: [
      {
        id: 'note-1',
        content: 'Handle with priority',
        authorName: 'Admin',
        isImportant: true,
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
      },
    ],
    spendingTrends: [],
    pointsActivity: [],
  }
}

describe('CustomerDetailClient', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/admin/customers/customer-1' && (!init || !init.method || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => buildCustomerPayload(),
        } as Response
      }

      if (url === '/api/admin/customers/customer-1' && init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            customer: {
              id: 'customer-1',
              updatedAt: '2026-03-21T10:00:00.000Z',
            },
          }),
        } as Response
      }

      if (url === '/api/admin/customers/customer-1/notes/note-1' && init?.method === 'DELETE') {
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

  it('saves in-context profile edits through PATCH route', async () => {
    render(<CustomerDetailClient customerId="customer-1" />)

    await screen.findAllByText('alice@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    fireEvent.change(screen.getByPlaceholderText('Customer name'), {
      target: { value: 'Alice Updated' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url) === '/api/admin/customers/customer-1' && init?.method === 'PATCH'
      )
      expect(patchCall).toBeTruthy()
      const body = patchCall?.[1]?.body ? JSON.parse(String(patchCall[1].body)) : null
      expect(body?.name).toBe('Alice Updated')
    })
  }, 15000)

  it('deletes notes with inline confirmation flow', async () => {
    render(<CustomerDetailClient customerId="customer-1" />)

    await screen.findAllByText('alice@example.com')
    const notesTab = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Notes'))
    expect(notesTab).toBeTruthy()
    fireEvent.click(notesTab as HTMLButtonElement)

    await screen.findByText('Handle with priority')
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Note' }))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url) === '/api/admin/customers/customer-1/notes/note-1' && init?.method === 'DELETE'
        )
      ).toBe(true)
    })
  })
})
