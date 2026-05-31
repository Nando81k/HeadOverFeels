// tests/unit/components/admin/products/ReviewReplyView.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewReplyView } from '@/components/admin/products/ReviewReplyView'
import type { ReviewWithReplies } from '@/lib/admin/products'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockReplyToReview = vi.fn()
vi.mock('@/app/admin/products/actions', () => ({
  replyToReview: (...args: unknown[]) => mockReplyToReview(...args),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseReview: ReviewWithReplies = {
  id: 'rev-001',
  customerName: 'Jordan P.',
  rating: 4,
  title: 'Great sneaker',
  body: 'Fits true to size. Very comfortable.',
  productName: 'Air Jordan 1 Retro High',
  productSku: 'AJ1-RT',
  productId: 'prod-abc',
  createdAt: new Date('2025-12-01T10:00:00Z'),
  status: 'APPROVED',
  isReported: false,
  replies: [],
}

const reviewWithReply: ReviewWithReplies = {
  ...baseReview,
  id: 'rev-002',
  replies: [
    {
      id: 'rev-002:reply',
      body: 'Thanks for your feedback, Jordan!',
      authorName: 'Admin',
      createdAt: new Date('2025-12-02T09:00:00Z'),
    },
  ],
}

const reviewPending: ReviewWithReplies = {
  ...baseReview,
  id: 'rev-003',
  status: 'PENDING',
  replies: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderView(review: ReviewWithReplies) {
  return render(<ReviewReplyView review={review} />)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewReplyView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Rendering ───────────────────────────────────────────────────────────────

  describe('review card', () => {
    it('renders the root container', () => {
      renderView(baseReview)
      expect(screen.getByTestId('review-reply-view')).toBeInTheDocument()
    })

    it('renders the customer name', () => {
      renderView(baseReview)
      expect(screen.getByText('Jordan P.')).toBeInTheDocument()
    })

    it('renders the review title', () => {
      renderView(baseReview)
      expect(screen.getByText('Great sneaker')).toBeInTheDocument()
    })

    it('renders the review body', () => {
      renderView(baseReview)
      expect(screen.getByText('Fits true to size. Very comfortable.')).toBeInTheDocument()
    })

    it('renders the product name', () => {
      renderView(baseReview)
      expect(screen.getByText('Air Jordan 1 Retro High')).toBeInTheDocument()
    })

    it('renders the product SKU', () => {
      renderView(baseReview)
      expect(screen.getByText('AJ1-RT')).toBeInTheDocument()
    })

    it('renders the review status badge', () => {
      renderView(baseReview)
      expect(screen.getByText('APPROVED')).toBeInTheDocument()
    })

    it('renders PENDING status for a pending review', () => {
      renderView(reviewPending)
      expect(screen.getByText('PENDING')).toBeInTheDocument()
    })

    it('renders a star rating accessible label', () => {
      renderView(baseReview)
      expect(screen.getByLabelText('4 out of 5 stars')).toBeInTheDocument()
    })

    it('does not render SKU section when productSku is null', () => {
      const noSku: ReviewWithReplies = { ...baseReview, productSku: null }
      renderView(noSku)
      expect(screen.queryByText(/sku/i)).not.toBeInTheDocument()
    })
  })

  // ── No existing replies ──────────────────────────────────────────────────────

  describe('when review has no replies', () => {
    it('does not render the "Admin Reply History" section', () => {
      renderView(baseReview)
      expect(screen.queryByLabelText('Existing replies')).not.toBeInTheDocument()
    })

    it('shows "Write a Reply" heading in composer', () => {
      renderView(baseReview)
      expect(screen.getByText('Write a Reply')).toBeInTheDocument()
    })

    it('does not render any existing-reply cards', () => {
      renderView(baseReview)
      expect(screen.queryAllByTestId('existing-reply')).toHaveLength(0)
    })
  })

  // ── With existing reply ──────────────────────────────────────────────────────

  describe('when review has an existing reply', () => {
    it('renders the "Admin Reply History" section', () => {
      renderView(reviewWithReply)
      expect(screen.getByLabelText('Existing replies')).toBeInTheDocument()
    })

    it('renders the existing reply body', () => {
      renderView(reviewWithReply)
      expect(screen.getByText('Thanks for your feedback, Jordan!')).toBeInTheDocument()
    })

    it('renders the existing reply author name', () => {
      renderView(reviewWithReply)
      expect(screen.getByText('Admin')).toBeInTheDocument()
    })

    it('renders one existing-reply card', () => {
      renderView(reviewWithReply)
      expect(screen.getAllByTestId('existing-reply')).toHaveLength(1)
    })

    it('shows "Edit Reply" heading in composer when reply exists', () => {
      renderView(reviewWithReply)
      expect(screen.getByText('Edit Reply')).toBeInTheDocument()
    })
  })

  // ── Textarea ─────────────────────────────────────────────────────────────────

  describe('textarea', () => {
    it('renders the reply textarea', () => {
      renderView(baseReview)
      expect(screen.getByLabelText('Reply body')).toBeInTheDocument()
    })

    it('is empty by default', () => {
      renderView(baseReview)
      const textarea = screen.getByLabelText('Reply body') as HTMLTextAreaElement
      expect(textarea.value).toBe('')
    })

    it('updates when the user types', () => {
      renderView(baseReview)
      const textarea = screen.getByLabelText('Reply body') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Test reply' } })
      expect(textarea.value).toBe('Test reply')
    })
  })

  // ── Submit button ────────────────────────────────────────────────────────────

  describe('Submit Reply button', () => {
    it('renders the submit button', () => {
      renderView(baseReview)
      expect(screen.getByRole('button', { name: /submit reply/i })).toBeInTheDocument()
    })

    it('calls replyToReview with correct args on submit', async () => {
      mockReplyToReview.mockResolvedValue({ ok: true })
      renderView(baseReview)

      fireEvent.change(screen.getByLabelText('Reply body'), {
        target: { value: 'Hello customer!' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /submit reply/i }))
      })

      expect(mockReplyToReview).toHaveBeenCalledWith('rev-001', 'Hello customer!')
    })

    it('shows success message after successful submit', async () => {
      mockReplyToReview.mockResolvedValue({ ok: true })
      renderView(baseReview)

      fireEvent.change(screen.getByLabelText('Reply body'), {
        target: { value: 'Good reply.' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /submit reply/i }))
      })

      await waitFor(() =>
        expect(screen.getByRole('status')).toBeInTheDocument(),
      )
      expect(screen.getByRole('status')).toHaveTextContent(/submitted successfully/i)
    })

    it('clears the textarea after successful submit', async () => {
      mockReplyToReview.mockResolvedValue({ ok: true })
      renderView(baseReview)

      const textarea = screen.getByLabelText('Reply body') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Good reply.' } })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /submit reply/i }))
      })

      await waitFor(() => expect(textarea.value).toBe(''))
    })

    it('shows error message when server returns ok: false', async () => {
      mockReplyToReview.mockResolvedValue({ ok: false, error: 'Reply body is required' })
      renderView(baseReview)

      fireEvent.change(screen.getByLabelText('Reply body'), {
        target: { value: 'Test' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /submit reply/i }))
      })

      await waitFor(() =>
        expect(screen.getByRole('alert')).toBeInTheDocument(),
      )
      expect(screen.getByRole('alert')).toHaveTextContent(/Reply body is required/)
    })
  })

  // ── Client-side validation ───────────────────────────────────────────────────

  describe('client-side validation', () => {
    it('shows error and does not call action when body is empty', async () => {
      renderView(baseReview)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /submit reply/i }))
      })

      expect(screen.getByRole('alert')).toHaveTextContent(/Reply body is required/i)
      expect(mockReplyToReview).not.toHaveBeenCalled()
    })

    it('shows error when body is only whitespace', async () => {
      renderView(baseReview)

      fireEvent.change(screen.getByLabelText('Reply body'), {
        target: { value: '   ' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /submit reply/i }))
      })

      expect(screen.getByRole('alert')).toHaveTextContent(/Reply body is required/i)
      expect(mockReplyToReview).not.toHaveBeenCalled()
    })
  })
})
