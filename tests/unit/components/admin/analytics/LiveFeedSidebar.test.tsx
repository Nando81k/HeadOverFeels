// tests/unit/components/admin/analytics/LiveFeedSidebar.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

import { LiveFeedSidebar } from '@/components/admin/analytics/LiveFeedSidebar'

describe('LiveFeedSidebar', () => {
  it('fetches /api/admin/sales/recent on mount and renders sales', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sales: [
          {
            id: 's1',
            orderNumber: '1001',
            customerName: 'Ada',
            total: 50,
            itemCount: 1,
            createdAt: new Date().toISOString(),
            status: 'CONFIRMED',
          },
        ],
      }),
    })
    render(<LiveFeedSidebar />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/sales/recent'))
    await waitFor(() => expect(screen.queryByText(/1001/)).toBeTruthy())
  })

  it('renders empty state when no sales', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sales: [] }) })
    render(<LiveFeedSidebar />)
    await waitFor(() => expect(screen.queryByText(/no recent/i)).toBeTruthy())
  })
})
