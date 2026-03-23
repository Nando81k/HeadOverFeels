import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TicketDetailPage from '@/app/admin/support/tickets/[id]/page'

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'ticket-1' }),
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function renderTicketPage() {
  return render(<TicketDetailPage />)
}

function buildTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    ticketNumber: 'TKT-2026-000001',
    subject: 'Need return',
    type: 'RETURN',
    status: 'OPEN',
    priority: 'HIGH',
    customerName: 'Alice',
    customerEmail: 'alice@example.com',
    customerId: null,
    orderId: 'order-1',
    orderNumber: 'HOF-1001',
    refundAmount: null,
    refundReason: null,
    returnRequested: true,
    returnApproved: null,
    returnLabel: null,
    aiAssisted: false,
    aiSummary: null,
    createdAt: '2026-03-21T10:00:00.000Z',
    updatedAt: '2026-03-21T10:00:00.000Z',
    resolvedAt: null,
    resolution: null,
    assignedTo: null,
    customer: null,
    order: { id: 'order-1', orderNumber: 'HOF-1001', total: 99 },
    messages: [
      {
        id: 'msg-1',
        message: 'Please approve my return',
        senderType: 'customer',
        senderName: 'Alice',
        createdAt: '2026-03-21T10:00:00.000Z',
        isInternal: false,
      },
    ],
    ...overrides,
  }
}

describe('Admin support ticket detail actions', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('open', vi.fn())
  })

  it('approves return requests through ticket PATCH endpoint', async () => {
    const ticket = buildTicket()

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/support/tickets/ticket-1' && (!init || !init.method)) {
        return { ok: true, json: async () => ({ data: ticket }) } as Response
      }
      if (url === '/api/support/tickets/ticket-1' && init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({ data: buildTicket({ returnApproved: true }) }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    renderTicketPage()
    await screen.findByText('Return Workflow')
    fireEvent.click(screen.getByRole('button', { name: 'Approve Return' }))

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url) === '/api/support/tickets/ticket-1' && init?.method === 'PATCH'
      )
      expect(patchCall).toBeTruthy()
      expect(String((patchCall?.[1] as RequestInit).body)).toContain('"returnApproved":true')
    })
  })

  it('generates and opens return label when return is approved', async () => {
    const ticket = buildTicket({ returnApproved: true })

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/support/tickets/ticket-1' && (!init || !init.method)) {
        return { ok: true, json: async () => ({ data: ticket }) } as Response
      }
      if (url === '/api/support/tickets/ticket-1' && init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            data: buildTicket({
              returnApproved: true,
              returnLabel: '/api/shipping/label/order-1',
            }),
          }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    renderTicketPage()
    await screen.findByRole('button', { name: 'Generate Return Label' })
    fireEvent.click(screen.getByRole('button', { name: 'Generate Return Label' }))

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith('/api/shipping/label/order-1', '_blank', 'noopener,noreferrer')
    })
  })
})
