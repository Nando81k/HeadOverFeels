// tests/unit/components/admin/products/ReviewsListView.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewsListView } from '@/components/admin/products/ReviewsListView'
import type { ReviewItem } from '@/lib/admin/products'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockApproveReview = vi.fn()
const mockRejectReview = vi.fn()

vi.mock('@/app/admin/products/actions', () => ({
  approveReview: (...args: unknown[]) => mockApproveReview(...args),
  rejectReview: (...args: unknown[]) => mockRejectReview(...args),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const pendingReview: ReviewItem = {
  id: 'rev-001',
  customerName: 'Jane Doe',
  rating: 4,
  title: 'Great pair of kicks',
  body: 'Really happy with the quality. Fits true to size.',
  productName: 'Air Jordan 1 Retro High',
  productSku: 'AJ1-001',
  productId: 'prod-abc',
  createdAt: new Date('2026-05-01T12:00:00Z'),
  status: 'PENDING',
  isReported: false,
}

const approvedReview: ReviewItem = {
  ...pendingReview,
  id: 'rev-002',
  customerName: 'John Smith',
  status: 'APPROVED',
}

const rejectedReview: ReviewItem = {
  ...pendingReview,
  id: 'rev-003',
  customerName: 'Alice Green',
  status: 'REJECTED',
}

const flaggedReview: ReviewItem = {
  ...pendingReview,
  id: 'rev-004',
  customerName: 'Bob White',
  status: 'FLAGGED',
}

// isReported always false from data layer — kept in fixture for spec completeness
const reportedReview: ReviewItem = {
  ...pendingReview,
  id: 'rev-005',
  customerName: 'Carol Red',
  status: 'PENDING',
  isReported: true,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderView(
  reviews: ReviewItem[],
  overrides: Partial<React.ComponentProps<typeof ReviewsListView>> = {},
) {
  const onMutated = vi.fn()
  const result = render(
    <ReviewsListView reviews={reviews} onMutated={onMutated} {...overrides} />,
  )
  return { ...result, onMutated }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewsListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Loading state ────────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('renders skeleton rows when loading=true', () => {
      renderView([], { loading: true, skeletonRows: 3 })
      // Skeleton rows are aria-hidden list items, list has label
      expect(screen.getByLabelText('Reviews loading')).toBeInTheDocument()
      // No real review rows
      expect(screen.queryByTestId('review-row')).not.toBeInTheDocument()
    })

    it('renders the correct number of skeleton rows', () => {
      const { container } = renderView([], { loading: true, skeletonRows: 4 })
      // skeleton lis have aria-hidden
      const skeletons = container.querySelectorAll('li[aria-hidden]')
      expect(skeletons).toHaveLength(4)
    })
  })

  // ── Empty state ──────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows "No reviews found." when reviews array is empty and not loading', () => {
      renderView([])
      expect(screen.getByText('No reviews found.')).toBeInTheDocument()
    })

    it('does not render the reviews list in empty state', () => {
      renderView([])
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })
  })

  // ── Rendering reviews ────────────────────────────────────────────────────────

  describe('rendering reviews', () => {
    it('renders the customer name', () => {
      renderView([pendingReview])
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })

    it('renders the star rating with aria-label', () => {
      renderView([pendingReview])
      expect(screen.getByLabelText('4 out of 5 stars')).toBeInTheDocument()
    })

    it('renders the review title', () => {
      renderView([pendingReview])
      expect(screen.getByText('Great pair of kicks')).toBeInTheDocument()
    })

    it('renders the review body', () => {
      renderView([pendingReview])
      expect(screen.getByText(/Really happy with the quality/i)).toBeInTheDocument()
    })

    it('renders the product name', () => {
      renderView([pendingReview])
      expect(screen.getByText('Air Jordan 1 Retro High')).toBeInTheDocument()
    })

    it('renders the product SKU', () => {
      renderView([pendingReview])
      expect(screen.getByText(/AJ1-001/)).toBeInTheDocument()
    })

    it('renders a review-row for each review', () => {
      renderView([pendingReview, approvedReview, rejectedReview])
      expect(screen.getAllByTestId('review-row')).toHaveLength(3)
    })

    it('renders the reviews list with aria-label', () => {
      renderView([pendingReview])
      expect(screen.getByRole('list', { name: 'Reviews list' })).toBeInTheDocument()
    })
  })

  // ── Status pills ─────────────────────────────────────────────────────────────

  describe('status pills', () => {
    it('shows Pending pill for PENDING review', () => {
      renderView([pendingReview])
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('shows Approved pill for APPROVED review', () => {
      renderView([approvedReview])
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })

    it('shows Rejected pill for REJECTED review', () => {
      renderView([rejectedReview])
      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })

    it('shows Flagged pill for FLAGGED review', () => {
      renderView([flaggedReview])
      expect(screen.getByText('Flagged')).toBeInTheDocument()
    })
  })

  // ── REPORTED badge ───────────────────────────────────────────────────────────

  describe('REPORTED badge', () => {
    it('does not render reported badge when isReported=false (normal case)', () => {
      renderView([pendingReview])
      expect(screen.queryByTestId('reported-badge')).not.toBeInTheDocument()
    })

    it('renders reported badge when isReported=true', () => {
      renderView([reportedReview])
      expect(screen.getByTestId('reported-badge')).toBeInTheDocument()
      expect(screen.getByTestId('reported-badge')).toHaveTextContent('Reported')
    })
  })

  // ── Approve / Reject buttons ─────────────────────────────────────────────────

  describe('inline action buttons', () => {
    it('shows Approve and Reject buttons for PENDING reviews', () => {
      renderView([pendingReview])
      expect(
        screen.getByRole('button', { name: /approve review by jane doe/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /reject review by jane doe/i }),
      ).toBeInTheDocument()
    })

    it('does not show Approve / Reject buttons for APPROVED reviews', () => {
      renderView([approvedReview])
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })

    it('does not show Approve / Reject buttons for REJECTED reviews', () => {
      renderView([rejectedReview])
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })

    it('does not show Approve / Reject buttons for FLAGGED reviews', () => {
      renderView([flaggedReview])
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })
  })

  // ── Approve action ───────────────────────────────────────────────────────────

  describe('Approve action', () => {
    it('calls approveReview with the correct review id', async () => {
      mockApproveReview.mockResolvedValue({ ok: true })
      renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /approve review by jane doe/i }))
      })

      expect(mockApproveReview).toHaveBeenCalledWith('rev-001')
    })

    it('optimistically updates the status pill to Approved after approval', async () => {
      mockApproveReview.mockResolvedValue({ ok: true })
      renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /approve review by jane doe/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('Approved')).toBeInTheDocument()
      })
    })

    it('hides Approve/Reject buttons after a successful approval', async () => {
      mockApproveReview.mockResolvedValue({ ok: true })
      renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /approve review by jane doe/i }))
      })

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
      })
    })

    it('calls onMutated after a successful approval', async () => {
      mockApproveReview.mockResolvedValue({ ok: true })
      const { onMutated } = renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /approve review by jane doe/i }))
      })

      await waitFor(() => expect(onMutated).toHaveBeenCalledOnce())
    })

    it('shows an error alert when approveReview fails', async () => {
      mockApproveReview.mockResolvedValue({ ok: false, error: 'Permission denied' })
      renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /approve review by jane doe/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Permission denied')
      })
    })

    it('does not call onMutated when approveReview fails', async () => {
      mockApproveReview.mockResolvedValue({ ok: false, error: 'err' })
      const { onMutated } = renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /approve review by jane doe/i }))
      })

      expect(onMutated).not.toHaveBeenCalled()
    })
  })

  // ── Reject action ────────────────────────────────────────────────────────────

  describe('Reject action', () => {
    it('calls rejectReview with the correct review id', async () => {
      mockRejectReview.mockResolvedValue({ ok: true })
      renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /reject review by jane doe/i }))
      })

      expect(mockRejectReview).toHaveBeenCalledWith('rev-001')
    })

    it('optimistically updates the status pill to Rejected after rejection', async () => {
      mockRejectReview.mockResolvedValue({ ok: true })
      renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /reject review by jane doe/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('Rejected')).toBeInTheDocument()
      })
    })

    it('calls onMutated after a successful rejection', async () => {
      mockRejectReview.mockResolvedValue({ ok: true })
      const { onMutated } = renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /reject review by jane doe/i }))
      })

      await waitFor(() => expect(onMutated).toHaveBeenCalledOnce())
    })

    it('shows an error alert when rejectReview fails', async () => {
      mockRejectReview.mockResolvedValue({ ok: false, error: 'Network error' })
      renderView([pendingReview])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /reject review by jane doe/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error')
      })
    })
  })

  // ── Multiple reviews ─────────────────────────────────────────────────────────

  describe('multiple reviews', () => {
    it('acts independently per row — approving one does not affect others', async () => {
      mockApproveReview.mockResolvedValue({ ok: true })
      renderView([pendingReview, { ...pendingReview, id: 'rev-006', customerName: 'Zara Blue' }])

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /approve review by jane doe/i }))
      })

      await waitFor(() => {
        // Jane Doe should now be Approved (no buttons)
        expect(screen.queryByRole('button', { name: /approve review by jane doe/i })).not.toBeInTheDocument()
      })

      // Zara Blue should still have Approve/Reject buttons
      expect(screen.getByRole('button', { name: /approve review by zara blue/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reject review by zara blue/i })).toBeInTheDocument()
    })
  })
})
