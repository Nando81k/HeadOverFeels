// tests/unit/components/admin/loyalty/inspectors/EventInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createEvent = vi.fn()
const updateEvent = vi.fn()
const deleteEvent = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  createEvent: (...a: unknown[]) => createEvent(...a),
  updateEvent: (...a: unknown[]) => updateEvent(...a),
  deleteEvent: (...a: unknown[]) => deleteEvent(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { EventInspector } from '@/components/admin/loyalty/inspectors/EventInspector'

const event = {
  id: 'e1',
  name: 'Memorial 2x',
  description: 'Double points',
  startDate: new Date('2026-05-25T00:00:00Z'),
  endDate: new Date('2026-05-27T23:59:59Z'),
  multiplier: 2,
  tierIds: null,
  categoryIds: null,
  isActive: true,
  totalBonusPointsAwarded: 100,
  ordersAffected: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('EventInspector', () => {
  it('renders empty form in create mode', () => {
    render(<EventInspector open detail={null} createMode onClose={() => {}} />)
    expect(screen.getByLabelText(/name/i)).toBeTruthy()
  })

  it('renders read-only stats in edit mode', () => {
    render(<EventInspector open detail={event} onClose={() => {}} />)
    expect(screen.getByText(/100/)).toBeTruthy()
    expect(screen.getByText(/5/)).toBeTruthy()
  })

  it('calls updateEvent on Save', async () => {
    updateEvent.mockResolvedValue({ ok: true })
    render(<EventInspector open detail={event} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateEvent).toHaveBeenCalled())
  })
})
