// tests/unit/components/admin/marketing/editor/PopupEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  updatePopup: vi.fn(async () => ({ ok: true })),
  togglePopupActive: vi.fn(async () => ({ ok: true })),
  createPopupVariant: vi.fn(async () => ({ ok: true, data: { id: 'v2' } })),
  updatePopupVariant: vi.fn(async () => ({ ok: true })),
  deletePopupVariant: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const detail = {
  id: 'pp1', name: 'Welcome', template: 'MODAL' as const, position: 'CENTER' as const,
  content: '{"title":"Welcome"}',
  triggerType: 'DELAY' as const, triggerValue: 3,
  showOnPages: 'all', showToNewVisitors: true, showToReturning: false,
  frequency: 'ONCE_PER_SESSION' as const,
  startDate: null, endDate: null,
  isActive: false, priority: 0, promotionId: null,
  createdAt: new Date(), updatedAt: new Date(),
  variants: [
    { id: 'v1', popupId: 'pp1', name: 'A', content: '{}', weight: 50, isActive: true,
      createdAt: new Date(), updatedAt: new Date() },
  ],
  analytics7d: { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
}

beforeEach(() => { vi.clearAllMocks() })

describe('PopupEditor', () => {
  it('renders all 7 sections', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    expect(screen.getByText('Basics')).toBeInTheDocument()
    expect(screen.getByText('Trigger')).toBeInTheDocument()
    expect(screen.getByText('Frequency')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByText('Targeting')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Activation')).toBeInTheDocument()
  })

  it('Save calls updatePopup', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    const { updatePopup } = await import('@/app/admin/marketing/actions')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Welcome v2' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(updatePopup).toHaveBeenCalledWith('pp1', expect.objectContaining({ name: 'Welcome v2' }))
    })
  })

  it('Activate calls togglePopupActive', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    const { togglePopupActive } = await import('@/app/admin/marketing/actions')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    fireEvent.click(screen.getByText(/^activate/i))
    await waitFor(() => { expect(togglePopupActive).toHaveBeenCalledWith('pp1') })
  })

  it('renders existing variants', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    expect(screen.getByDisplayValue('A')).toBeInTheDocument()
  })

  it('Add variant calls createPopupVariant', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    const { createPopupVariant } = await import('@/app/admin/marketing/actions')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    fireEvent.click(screen.getByText(/\+ Add variant/i))
    await waitFor(() => { expect(createPopupVariant).toHaveBeenCalled() })
  })
})
