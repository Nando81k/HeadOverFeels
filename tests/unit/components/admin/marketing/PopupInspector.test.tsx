// tests/unit/components/admin/marketing/PopupInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PopupInspector } from '@/components/admin/marketing/PopupInspector'
import type { PopupDetailFull } from '@/app/admin/marketing/actions'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockUpdatePopup = vi.fn()
const mockTogglePopupActive = vi.fn()

vi.mock('@/app/admin/marketing/actions', () => ({
  updatePopup: (...a: unknown[]) => mockUpdatePopup(...a),
  togglePopupActive: (...a: unknown[]) => mockTogglePopupActive(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseDetail: PopupDetailFull = {
  id: 'popup-1',
  name: 'Welcome Offer',
  template: 'MODAL',
  position: 'CENTER',
  content: 'Get 10% off your first order',
  triggerType: 'DELAY',
  triggerValue: 3000,
  showOnPages: '*',
  showToNewVisitors: true,
  showToReturning: false,
  frequency: 'ONCE_PER_SESSION',
  startDate: null,
  endDate: null,
  isActive: true,
  priority: 1,
  promotionId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  variants: [],
  analytics7d: {
    impressions: 120,
    clicks: 30,
    dismissals: 15,
    conversions: 8,
  },
}

const inactiveDetail: PopupDetailFull = {
  ...baseDetail,
  id: 'popup-2',
  name: 'Inactive Banner',
  template: 'BANNER',
  position: 'TOP',
  triggerType: 'IMMEDIATE',
  triggerValue: 0,
  frequency: 'ALWAYS',
  isActive: false,
}

const withVariants: PopupDetailFull = {
  ...baseDetail,
  id: 'popup-3',
  name: 'A/B Test Popup',
  variants: [
    { id: 'v1', popupId: 'popup-3', name: 'Variant A', content: 'A', weight: 50, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'v2', popupId: 'popup-3', name: 'Variant B', content: 'B', weight: 50, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ],
}

const scrollDetail: PopupDetailFull = {
  ...baseDetail,
  id: 'popup-4',
  name: 'Scroll Popup',
  triggerType: 'SCROLL',
  triggerValue: 50,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderInspector(
  detail: PopupDetailFull | null,
  overrides: Partial<React.ComponentProps<typeof PopupInspector>> = {},
) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const result = render(
    <PopupInspector
      open={detail !== null}
      detail={detail}
      onClose={onClose}
      onSaved={onSaved}
      {...overrides}
    />,
  )
  return { ...result, onClose, onSaved }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PopupInspector', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Closed state ────────────────────────────────────────────────────────────

  describe('when closed (open=false, detail=null)', () => {
    it('renders nothing when not open', () => {
      const { container } = render(
        <PopupInspector open={false} detail={null} onClose={() => {}} />,
      )
      expect(container.querySelector('[role="dialog"]')).toBeNull()
    })
  })

  // ── Open state ──────────────────────────────────────────────────────────────

  describe('when open with detail', () => {
    it('renders the popup name as the inspector title', () => {
      renderInspector(baseDetail)
      expect(screen.getByText('Welcome Offer')).toBeInTheDocument()
    })

    it('renders analytics 7d impressions', () => {
      renderInspector(baseDetail)
      expect(screen.getByText('120')).toBeInTheDocument()
    })

    it('renders analytics 7d clicks', () => {
      renderInspector(baseDetail)
      expect(screen.getByText('30')).toBeInTheDocument()
    })

    it('renders analytics 7d dismissals', () => {
      renderInspector(baseDetail)
      expect(screen.getByText('15')).toBeInTheDocument()
    })

    it('renders analytics 7d conversions', () => {
      renderInspector(baseDetail)
      expect(screen.getByText('8')).toBeInTheDocument()
    })
  })

  // ── A/B variant count ──────────────────────────────────────────────────────

  describe('variant count display', () => {
    it('shows variant count when variants exist', () => {
      renderInspector(withVariants)
      expect(screen.getByText(/2 A\/B variants/i)).toBeInTheDocument()
    })

    it('does not show variant text when no variants', () => {
      renderInspector(baseDetail)
      expect(screen.queryByText(/variant/i)).not.toBeInTheDocument()
    })
  })

  // ── isActive toggle ────────────────────────────────────────────────────────

  describe('isActive toggle', () => {
    it('reflects active state (aria-checked=true) for active popup', () => {
      renderInspector(baseDetail)
      const toggle = screen.getByRole('switch', { name: /toggle popup active/i })
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })

    it('reflects inactive state (aria-checked=false) for inactive popup', () => {
      renderInspector(inactiveDetail)
      const toggle = screen.getByRole('switch', { name: /toggle popup active/i })
      expect(toggle).toHaveAttribute('aria-checked', 'false')
    })

    it('calls togglePopupActive with id and next=false when toggling off', async () => {
      mockTogglePopupActive.mockResolvedValue({ ok: true })
      renderInspector(baseDetail)
      const toggle = screen.getByRole('switch', { name: /toggle popup active/i })
      fireEvent.click(toggle)
      await waitFor(() =>
        expect(mockTogglePopupActive).toHaveBeenCalledWith('popup-1', false),
      )
    })

    it('calls togglePopupActive with id and next=true when toggling on', async () => {
      mockTogglePopupActive.mockResolvedValue({ ok: true })
      renderInspector(inactiveDetail)
      const toggle = screen.getByRole('switch', { name: /toggle popup active/i })
      fireEvent.click(toggle)
      await waitFor(() =>
        expect(mockTogglePopupActive).toHaveBeenCalledWith('popup-2', true),
      )
    })

    it('calls onSaved after successful toggle', async () => {
      mockTogglePopupActive.mockResolvedValue({ ok: true })
      const { onSaved } = renderInspector(baseDetail)
      fireEvent.click(screen.getByRole('switch', { name: /toggle popup active/i }))
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith('popup-1'))
    })
  })

  // ── Form fields ────────────────────────────────────────────────────────────

  describe('name field', () => {
    it('is pre-filled with the popup name', () => {
      renderInspector(baseDetail)
      const input = screen.getByLabelText(/^name$/i) as HTMLInputElement
      expect(input.value).toBe('Welcome Offer')
    })

    it('updates when the user types', () => {
      renderInspector(baseDetail)
      const input = screen.getByLabelText(/^name$/i) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'New Offer' } })
      expect(input.value).toBe('New Offer')
    })
  })

  describe('template select', () => {
    it('is pre-selected with the popup template', () => {
      renderInspector(baseDetail)
      const select = screen.getByLabelText(/^template$/i) as HTMLSelectElement
      expect(select.value).toBe('MODAL')
    })

    it('renders all 5 template options', () => {
      renderInspector(baseDetail)
      const select = screen.getByLabelText(/^template$/i) as HTMLSelectElement
      expect(select.options.length).toBe(5)
    })

    it('updates when changed', () => {
      renderInspector(baseDetail)
      const select = screen.getByLabelText(/^template$/i) as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'BANNER' } })
      expect(select.value).toBe('BANNER')
    })
  })

  describe('position select', () => {
    it('is pre-selected with the popup position', () => {
      renderInspector(baseDetail)
      const select = screen.getByLabelText(/^position$/i) as HTMLSelectElement
      expect(select.value).toBe('CENTER')
    })

    it('renders all 7 position options', () => {
      renderInspector(baseDetail)
      const select = screen.getByLabelText(/^position$/i) as HTMLSelectElement
      expect(select.options.length).toBe(7)
    })
  })

  describe('trigger select', () => {
    it('is pre-selected with the popup trigger', () => {
      renderInspector(baseDetail)
      const select = screen.getByLabelText(/^trigger$/i) as HTMLSelectElement
      expect(select.value).toBe('DELAY')
    })

    it('renders all 4 trigger options', () => {
      renderInspector(baseDetail)
      const select = screen.getByLabelText(/^trigger$/i) as HTMLSelectElement
      expect(select.options.length).toBe(4)
    })

    it('shows triggerValue input for DELAY trigger', () => {
      renderInspector(baseDetail)
      expect(screen.getByLabelText(/trigger value/i)).toBeInTheDocument()
    })

    it('shows triggerValue input for SCROLL trigger', () => {
      renderInspector(scrollDetail)
      expect(screen.getByLabelText(/trigger value/i)).toBeInTheDocument()
    })

    it('hides triggerValue input for IMMEDIATE trigger', () => {
      renderInspector(inactiveDetail) // inactiveDetail uses IMMEDIATE
      expect(screen.queryByLabelText(/trigger value/i)).not.toBeInTheDocument()
    })

    it('pre-fills triggerValue with popup value', () => {
      renderInspector(baseDetail)
      const input = screen.getByLabelText(/trigger value/i) as HTMLInputElement
      expect(input.value).toBe('3000')
    })
  })

  describe('frequency select', () => {
    it('is pre-selected with the popup frequency', () => {
      renderInspector(baseDetail)
      const select = screen.getByLabelText(/^frequency$/i) as HTMLSelectElement
      expect(select.value).toBe('ONCE_PER_SESSION')
    })

    it('renders all 4 frequency options', () => {
      renderInspector(baseDetail)
      const select = screen.getByLabelText(/^frequency$/i) as HTMLSelectElement
      expect(select.options.length).toBe(4)
    })
  })

  describe('content textarea', () => {
    it('is pre-filled with popup content', () => {
      renderInspector(baseDetail)
      const textarea = screen.getByLabelText(/^content$/i) as HTMLTextAreaElement
      expect(textarea.value).toBe('Get 10% off your first order')
    })

    it('updates when the user types', () => {
      renderInspector(baseDetail)
      const textarea = screen.getByLabelText(/^content$/i) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'New content here' } })
      expect(textarea.value).toBe('New content here')
    })
  })

  // ── Save action ────────────────────────────────────────────────────────────

  describe('Save button', () => {
    it('calls updatePopup with the current field values', async () => {
      mockUpdatePopup.mockResolvedValue({ ok: true })
      renderInspector(baseDetail)

      fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Updated Name' } })
      fireEvent.click(screen.getByTestId('popup-inspector-save'))

      await waitFor(() =>
        expect(mockUpdatePopup).toHaveBeenCalledWith(
          'popup-1',
          expect.objectContaining({ name: 'Updated Name' }),
        ),
      )
    })

    it('sends template, position, triggerType, frequency, content, isActive', async () => {
      mockUpdatePopup.mockResolvedValue({ ok: true })
      renderInspector(baseDetail)

      fireEvent.click(screen.getByTestId('popup-inspector-save'))

      await waitFor(() =>
        expect(mockUpdatePopup).toHaveBeenCalledWith(
          'popup-1',
          expect.objectContaining({
            template: 'MODAL',
            position: 'CENTER',
            triggerType: 'DELAY',
            frequency: 'ONCE_PER_SESSION',
            content: 'Get 10% off your first order',
            isActive: true,
          }),
        ),
      )
    })

    it('calls onSaved with popup id after successful save', async () => {
      mockUpdatePopup.mockResolvedValue({ ok: true })
      const { onSaved } = renderInspector(baseDetail)

      fireEvent.click(screen.getByTestId('popup-inspector-save'))

      await waitFor(() => expect(onSaved).toHaveBeenCalledWith('popup-1'))
    })
  })

  // ── Cancel button ──────────────────────────────────────────────────────────

  describe('Cancel button', () => {
    it('calls onClose when Cancel is clicked', () => {
      const { onClose } = renderInspector(baseDetail)
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  // ── Open editor link ───────────────────────────────────────────────────────

  describe('Open editor link', () => {
    it('points to /admin/marketing/popups/[id]/edit', () => {
      renderInspector(baseDetail)
      const link = screen.getByRole('link', { name: /open editor/i })
      expect(link).toHaveAttribute('href', '/admin/marketing/popups/popup-1/edit')
    })
  })

  // ── Form reset on detail change ────────────────────────────────────────────

  describe('form reset when detail changes', () => {
    it('resets all fields when a new detail is provided', () => {
      const { rerender } = renderInspector(baseDetail)

      fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Dirty' } })

      rerender(
        <PopupInspector
          open={true}
          detail={inactiveDetail}
          onClose={() => {}}
          onSaved={() => {}}
        />,
      )

      const input = screen.getByLabelText(/^name$/i) as HTMLInputElement
      expect(input.value).toBe('Inactive Banner')
    })
  })

})
