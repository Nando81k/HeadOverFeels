import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getEventDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getEventDetailForInspector: (...a: unknown[]) => getEventDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/EventInspector', () => ({
  EventInspector: ({ open, createMode }: { open: boolean; createMode?: boolean }) =>
    open ? <div data-testid={createMode ? 'event-create' : 'event-edit'} /> : null,
}))
vi.mock('@/components/admin/loyalty/bulk/EventsBulkSheet', () => ({
  EventsBulkSheet: ({ selectedIds }: { selectedIds: string[] }) =>
    selectedIds.length > 0 ? <div data-testid="events-bulk" /> : null,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { EventsTab } from '@/components/admin/loyalty/tabs/EventsTab'

const data = {
  items: [
    {
      id: 'e1',
      name: 'Memorial 2x',
      description: 'd',
      startDate: new Date('2026-05-25'),
      endDate: new Date('2026-05-27'),
      multiplier: 2,
      isActive: true,
      totalBonusPointsAwarded: 100,
      ordersAffected: 5,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
}

beforeEach(() => vi.clearAllMocks())

describe('EventsTab', () => {
  it('renders cards', () => {
    render(<EventsTab data={data} range="30d" />)
    expect(screen.getByText(/Memorial 2x/)).toBeTruthy()
  })
  it('opens create inspector', () => {
    render(<EventsTab data={data} range="30d" />)
    fireEvent.click(screen.getByRole('button', { name: /new event/i }))
    expect(screen.getByTestId('event-create')).toBeTruthy()
  })
  it('opens edit inspector on card click', async () => {
    getEventDetailForInspector.mockResolvedValue({
      ...data.items[0],
      tierIds: null,
      categoryIds: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    render(<EventsTab data={data} range="30d" />)
    fireEvent.click(screen.getByText(/Memorial 2x/))
    await waitFor(() => expect(screen.queryByTestId('event-edit')).toBeTruthy())
  })
})
