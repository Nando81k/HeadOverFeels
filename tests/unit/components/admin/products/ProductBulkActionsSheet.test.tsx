// tests/unit/components/admin/products/ProductBulkActionsSheet.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProductBulkActionsSheet } from '@/components/admin/products/ProductBulkActionsSheet'

// ─── Mock server actions ───────────────────────────────────────────────────────

vi.mock('@/app/admin/products/actions', () => ({
  bulkArchive: vi.fn(),
  bulkDelete: vi.fn(),
  bulkDuplicate: vi.fn(),
  bulkChangeCategory: vi.fn(),
  bulkPriceUpdate: vi.fn(),
  bulkAddTag: vi.fn(),
  bulkSetFeatured: vi.fn(),
}))

// ─── Mock sonner toast ─────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ─── Mock framer-motion (avoids animation timing issues) ──────────────────────

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}))

// ─── Imports after mocking ────────────────────────────────────────────────────

import {
  bulkArchive,
  bulkDelete,
  bulkDuplicate,
  bulkChangeCategory,
  bulkPriceUpdate,
  bulkAddTag,
  bulkSetFeatured,
} from '@/app/admin/products/actions'
import { toast } from 'sonner'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const defaultProps = {
  selectedIds: ['p1', 'p2', 'p3'],
  open: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
}

function renderSheet(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return { ...render(<ProductBulkActionsSheet {...props} />), props }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProductBulkActionsSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset browser dialog mocks
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'prompt').mockReturnValue('set:50')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Rendering ──────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the sheet when open=true', () => {
      renderSheet()
      expect(screen.getByTestId('bulk-actions-sheet')).toBeInTheDocument()
    })

    it('does not render the sheet when open=false', () => {
      renderSheet({ open: false })
      expect(screen.queryByTestId('bulk-actions-sheet')).not.toBeInTheDocument()
    })

    it('shows the selected count in the header', () => {
      renderSheet({ selectedIds: ['p1', 'p2', 'p3'] })
      expect(screen.getByText('3 products selected')).toBeInTheDocument()
    })

    it('uses singular "product" when 1 item selected', () => {
      renderSheet({ selectedIds: ['p1'] })
      expect(screen.getByText('1 product selected')).toBeInTheDocument()
    })

    it('renders "Bulk Actions" heading', () => {
      renderSheet()
      expect(screen.getByText('Bulk Actions')).toBeInTheDocument()
    })

    it('renders all 7 action labels', () => {
      renderSheet()
      expect(screen.getByLabelText('Archive')).toBeInTheDocument()
      expect(screen.getByLabelText('Delete')).toBeInTheDocument()
      expect(screen.getByLabelText('Duplicate')).toBeInTheDocument()
      expect(screen.getByLabelText('Change Category')).toBeInTheDocument()
      expect(screen.getByLabelText('Price Update')).toBeInTheDocument()
      expect(screen.getByLabelText('Add Tag')).toBeInTheDocument()
      expect(screen.getByLabelText('Mark Featured')).toBeInTheDocument()
      expect(screen.getByLabelText('Unmark Featured')).toBeInTheDocument()
    })

    it('renders a close button', () => {
      renderSheet()
      expect(screen.getByLabelText('Close bulk actions')).toBeInTheDocument()
    })
  })

  // ── Close behaviour ────────────────────────────────────────────────────────

  describe('close behaviour', () => {
    it('calls onClose when close button is clicked', () => {
      const { props } = renderSheet()
      fireEvent.click(screen.getByLabelText('Close bulk actions'))
      expect(props.onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose when backdrop is clicked', () => {
      const { props } = renderSheet()
      const backdrop = document.querySelector('[aria-hidden="true"]')
      expect(backdrop).toBeInTheDocument()
      fireEvent.click(backdrop!)
      expect(props.onClose).toHaveBeenCalledOnce()
    })
  })

  // ── Archive ────────────────────────────────────────────────────────────────

  describe('Archive action', () => {
    it('calls bulkArchive with selectedIds on confirm', async () => {
      vi.mocked(bulkArchive).mockResolvedValue({ ok: true, affected: 3 })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Archive'))
      await waitFor(() => expect(bulkArchive).toHaveBeenCalledWith(['p1', 'p2', 'p3']))
    })

    it('does NOT call bulkArchive when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderSheet()
      fireEvent.click(screen.getByLabelText('Archive'))
      await waitFor(() => expect(bulkArchive).not.toHaveBeenCalled())
    })

    it('shows success toast and calls onSuccess after archiving', async () => {
      vi.mocked(bulkArchive).mockResolvedValue({ ok: true, affected: 3 })
      const { props } = renderSheet()
      fireEvent.click(screen.getByLabelText('Archive'))
      await waitFor(() => expect(toast.success).toHaveBeenCalled())
      expect(props.onSuccess).toHaveBeenCalled()
    })

    it('shows error toast when bulkArchive returns ok:false', async () => {
      vi.mocked(bulkArchive).mockResolvedValue({ ok: false, error: 'No products selected' })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Archive'))
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No products selected'))
    })
  })

  // ── Delete ─────────────────────────────────────────────────────────────────

  describe('Delete action', () => {
    it('calls bulkDelete with selectedIds on confirm', async () => {
      vi.mocked(bulkDelete).mockResolvedValue({ ok: true, affected: 2 })
      renderSheet({ selectedIds: ['p1', 'p2'] })
      fireEvent.click(screen.getByLabelText('Delete'))
      await waitFor(() => expect(bulkDelete).toHaveBeenCalledWith(['p1', 'p2']))
    })

    it('does NOT call bulkDelete when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderSheet()
      fireEvent.click(screen.getByLabelText('Delete'))
      expect(bulkDelete).not.toHaveBeenCalled()
    })
  })

  // ── Duplicate ──────────────────────────────────────────────────────────────

  describe('Duplicate action', () => {
    it('calls bulkDuplicate with selectedIds on confirm', async () => {
      vi.mocked(bulkDuplicate).mockResolvedValue({ ok: true, affected: 3 })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Duplicate'))
      await waitFor(() => expect(bulkDuplicate).toHaveBeenCalledWith(['p1', 'p2', 'p3']))
    })

    it('does NOT call bulkDuplicate when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderSheet()
      fireEvent.click(screen.getByLabelText('Duplicate'))
      expect(bulkDuplicate).not.toHaveBeenCalled()
    })
  })

  // ── Change Category ────────────────────────────────────────────────────────

  describe('Change Category action', () => {
    it('calls bulkChangeCategory with the prompted category id', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('cat-abc')
      vi.mocked(bulkChangeCategory).mockResolvedValue({ ok: true, affected: 3 })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Change Category'))
      await waitFor(() =>
        expect(bulkChangeCategory).toHaveBeenCalledWith(['p1', 'p2', 'p3'], 'cat-abc'),
      )
    })

    it('does NOT call bulkChangeCategory when prompt is cancelled', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue(null)
      renderSheet()
      fireEvent.click(screen.getByLabelText('Change Category'))
      expect(bulkChangeCategory).not.toHaveBeenCalled()
    })

    it('does NOT call bulkChangeCategory when prompt returns empty string', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('   ')
      renderSheet()
      fireEvent.click(screen.getByLabelText('Change Category'))
      expect(bulkChangeCategory).not.toHaveBeenCalled()
    })
  })

  // ── Price Update ───────────────────────────────────────────────────────────

  describe('Price Update action', () => {
    it('parses set: prefix and calls bulkPriceUpdate with mode=set', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('set:99.99')
      vi.mocked(bulkPriceUpdate).mockResolvedValue({ ok: true, affected: 3 })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Price Update'))
      await waitFor(() =>
        expect(bulkPriceUpdate).toHaveBeenCalledWith(['p1', 'p2', 'p3'], {
          mode: 'set',
          value: 99.99,
        }),
      )
    })

    it('parses % suffix and calls bulkPriceUpdate with mode=adjust-pct', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('10%')
      vi.mocked(bulkPriceUpdate).mockResolvedValue({ ok: true, affected: 3 })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Price Update'))
      await waitFor(() =>
        expect(bulkPriceUpdate).toHaveBeenCalledWith(['p1', 'p2', 'p3'], {
          mode: 'adjust-pct',
          value: 10,
        }),
      )
    })

    it('parses plain number and calls bulkPriceUpdate with mode=adjust-amount', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('+15')
      vi.mocked(bulkPriceUpdate).mockResolvedValue({ ok: true, affected: 3 })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Price Update'))
      await waitFor(() =>
        expect(bulkPriceUpdate).toHaveBeenCalledWith(['p1', 'p2', 'p3'], {
          mode: 'adjust-amount',
          value: 15,
        }),
      )
    })

    it('does NOT call bulkPriceUpdate when prompt is cancelled', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue(null)
      renderSheet()
      fireEvent.click(screen.getByLabelText('Price Update'))
      expect(bulkPriceUpdate).not.toHaveBeenCalled()
    })

    it('shows error toast for invalid price value', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('not-a-number')
      renderSheet()
      fireEvent.click(screen.getByLabelText('Price Update'))
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid price value.'))
      expect(bulkPriceUpdate).not.toHaveBeenCalled()
    })
  })

  // ── Add Tag ────────────────────────────────────────────────────────────────

  describe('Add Tag action', () => {
    it('calls bulkAddTag with the prompted tag', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('bestseller')
      vi.mocked(bulkAddTag).mockResolvedValue({
        ok: false,
        error: 'Tag management requires a tags field on Product (not yet in schema)',
      })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Add Tag'))
      await waitFor(() =>
        expect(bulkAddTag).toHaveBeenCalledWith(['p1', 'p2', 'p3'], 'bestseller'),
      )
    })

    it('shows the server error toast for the tag stub', async () => {
      const errorMsg = 'Tag management requires a tags field on Product (not yet in schema)'
      vi.spyOn(window, 'prompt').mockReturnValue('new-tag')
      vi.mocked(bulkAddTag).mockResolvedValue({ ok: false, error: errorMsg })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Add Tag'))
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(errorMsg))
    })

    it('does NOT call bulkAddTag when prompt is cancelled', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue(null)
      renderSheet()
      fireEvent.click(screen.getByLabelText('Add Tag'))
      expect(bulkAddTag).not.toHaveBeenCalled()
    })
  })

  // ── Set Featured ───────────────────────────────────────────────────────────

  describe('Set Featured action', () => {
    it('calls bulkSetFeatured(ids, true) when Mark Featured is clicked', async () => {
      vi.mocked(bulkSetFeatured).mockResolvedValue({ ok: true, affected: 3 })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Mark Featured'))
      await waitFor(() =>
        expect(bulkSetFeatured).toHaveBeenCalledWith(['p1', 'p2', 'p3'], true),
      )
    })

    it('calls bulkSetFeatured(ids, false) when Unmark Featured is clicked', async () => {
      vi.mocked(bulkSetFeatured).mockResolvedValue({ ok: true, affected: 3 })
      renderSheet()
      fireEvent.click(screen.getByLabelText('Unmark Featured'))
      await waitFor(() =>
        expect(bulkSetFeatured).toHaveBeenCalledWith(['p1', 'p2', 'p3'], false),
      )
    })

    it('does NOT call bulkSetFeatured when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderSheet()
      fireEvent.click(screen.getByLabelText('Mark Featured'))
      expect(bulkSetFeatured).not.toHaveBeenCalled()
    })
  })

  // ── Success / Error flow ───────────────────────────────────────────────────

  describe('success and error flow', () => {
    it('calls onClose after a successful action', async () => {
      vi.mocked(bulkArchive).mockResolvedValue({ ok: true, affected: 3 })
      const { props } = renderSheet()
      fireEvent.click(screen.getByLabelText('Archive'))
      await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    })

    it('does NOT call onClose after a failed action', async () => {
      vi.mocked(bulkArchive).mockResolvedValue({ ok: false, error: 'Server error' })
      const { props } = renderSheet()
      fireEvent.click(screen.getByLabelText('Archive'))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(props.onClose).not.toHaveBeenCalled()
    })

    it('shows error toast when action throws', async () => {
      vi.mocked(bulkArchive).mockRejectedValue(new Error('Network failure'))
      renderSheet()
      fireEvent.click(screen.getByLabelText('Archive'))
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('An unexpected error occurred.'),
      )
    })
  })
})
