import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TicketsPage from '@/app/admin/support/tickets/page'

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

vi.mock('@/components/admin/support/AdminLiveChatQueue', () => ({
  AdminLiveChatQueue: () => <div data-testid="chat-queue" />,
}))

vi.mock('@/components/admin/support/AdminLiveChatPanel', () => ({
  AdminLiveChatPanel: () => <div data-testid="chat-panel" />,
}))

describe('Admin support tickets list', () => {
  beforeEach(() => {
    vi.useRealTimers()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/support/tickets?')) {
        return {
          ok: true,
          json: async () => ({
            tickets: [
              {
                id: 'ticket-1',
                ticketNumber: 'TKT-2026-000001',
                subject: 'Where is my order?',
                type: 'SHIPPING_ISSUE',
                status: 'OPEN',
                priority: 'HIGH',
                customerName: 'Alice',
                customerEmail: 'alice@example.com',
                aiAssisted: false,
                createdAt: '2026-03-21T10:00:00.000Z',
                assignedTo: null,
                order: { id: 'order-1', orderNumber: 'HOF-1001' },
                returnRequested: false,
                refundAmount: null,
                _count: { messages: 2 },
              },
            ],
            pagination: {
              page: 1,
              limit: 20,
              totalCount: 45,
              totalPages: 3,
            },
          }),
        } as Response
      }

      if (url === '/api/chat/live/admin/queue') {
        return {
          ok: true,
          json: async () => ({ sessions: [] }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    })
  })

  it('uses pagination.totalPages and renders page controls', async () => {
    render(<TicketsPage />)

    await screen.findAllByText('TKT-2026-000001')
    const pageLabels = screen.getAllByText((_, element) => element?.textContent?.includes('Page 1 of 3') ?? false)
    expect(pageLabels.length).toBeGreaterThan(0)
  })

  it('applies debounced search to fetch query params', async () => {
    render(<TicketsPage />)

    await screen.findAllByText('TKT-2026-000001')
    fireEvent.change(screen.getByPlaceholderText('Ticket #, customer, subject, or order #'), {
      target: { value: 'alice' },
    })

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url))
      expect(calls.some((url) => url.includes('/api/support/tickets?') && url.includes('search=alice'))).toBe(true)
    }, { timeout: 2000 })
  })
})
