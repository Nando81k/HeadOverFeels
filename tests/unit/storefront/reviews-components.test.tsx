// tests/unit/storefront/reviews-components.test.tsx — components/storefront/reviews/*
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))
vi.mock('@/app/(storefront)/_actions/reviews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(storefront)/_actions/reviews')>()
  return { ...actual, submitReviewAction: vi.fn(), listReviewsAction: vi.fn() }
})
vi.mock('@/components/storefront/account/useCustomer', () => ({
  useCustomerOptional: () => customerState.current,
}))

const customerState = vi.hoisted(() => ({ current: null as null | { status: string } }))

import type { ReviewFormState } from '@/app/(storefront)/_actions/reviews'
import type { ReviewItem, ReviewPage, ReviewSummary as ReviewSummaryData } from '@/lib/storefront/reviews'
import { onAnalyticsEvent } from '@/lib/storefront/analytics'
import { ReviewCard, formatReviewDate } from '@/components/storefront/reviews/ReviewCard'
import { ReviewForm, REVIEW_SUCCESS_COPY } from '@/components/storefront/reviews/ReviewForm'
import { ReviewList } from '@/components/storefront/reviews/ReviewList'
import { ReviewsSection } from '@/components/storefront/reviews/ReviewsSection'
import { ReviewSummary } from '@/components/storefront/reviews/ReviewSummary'
import { Stars } from '@/components/storefront/reviews/Stars'
import { Textarea } from '@/components/storefront/ui/Textarea'

const review = (overrides: Partial<ReviewItem> = {}): ReviewItem => ({
  id: 'r1',
  rating: 5,
  title: 'Heavy in the best way',
  comment: 'Thick fleece, honest fit.',
  authorName: 'Nando R.',
  isVerified: true,
  createdAt: '2026-10-01T12:00:00.000Z',
  adminReply: null,
  helpfulCount: 0,
  ...overrides,
})

const SUMMARY: ReviewSummaryData = {
  handle: 'core-hoodie',
  average: 4.5,
  count: 4,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 2 },
}

const PAGE: ReviewPage = { items: [review(), review({ id: 'r2', rating: 4, title: null, isVerified: false })], nextCursor: 'r2', total: 3 }

beforeEach(() => {
  vi.clearAllMocks()
  customerState.current = { status: 'ready' }
})
afterEach(cleanup)

describe('Stars', () => {
  it('announces the rating and exposes a partial fill', () => {
    render(<Stars rating={4.3} />)
    const stars = screen.getByRole('img', { name: '4.3 out of 5 stars' })
    expect(stars).toHaveAttribute('data-stars', '4.3')
    expect(stars.querySelector('span[aria-hidden="true"]')).toHaveStyle({ width: '86%' })
  })
})

describe('ReviewSummary', () => {
  it('renders the average, count and histogram', () => {
    render(<ReviewSummary summary={SUMMARY} />)
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText(/Based on/)).toHaveTextContent('Based on 4 reviews')
    const rows = within(screen.getByRole('list', { name: 'Rating breakdown' })).getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('5 star')
  })

  it('renders the empty state', () => {
    render(<ReviewSummary summary={{ ...SUMMARY, average: 0, count: 0 }} />)
    expect(screen.getByText(/No reviews yet/)).toHaveAttribute('data-review-summary', 'empty')
  })
})

describe('ReviewCard', () => {
  it('shows title, body, author, verified badge, date and admin reply', () => {
    render(<ReviewCard review={review({ adminReply: 'Thanks, Nando.' })} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Heavy in the best way' })).toBeInTheDocument()
    expect(screen.getByText('Nando R.')).toBeInTheDocument()
    expect(screen.getByText('Verified purchase')).toBeInTheDocument()
    expect(screen.getByText(formatReviewDate('2026-10-01T12:00:00.000Z'))).toHaveAttribute('datetime', '2026-10-01T12:00:00.000Z')
    expect(screen.getByText('Thanks, Nando.')).toBeInTheDocument()
  })

  it('omits the badge for an unverified review and links the product label', () => {
    render(<ReviewCard review={review({ isVerified: false })} productLabel={{ title: 'Core Hoodie', href: '/products/core-hoodie#reviews' }} />)
    expect(screen.queryByText('Verified purchase')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Core Hoodie' })).toHaveAttribute('href', '/products/core-hoodie#reviews')
  })
})

describe('ReviewList', () => {
  it('renders the first page and loads more through the action', async () => {
    const load = vi.fn(async () => ({
      ok: true as const,
      data: { items: [review({ id: 'r3', title: 'Third' })], nextCursor: null, total: 3 },
    }))
    const { container } = render(<ReviewList handle="core-hoodie" initial={PAGE} load={load} />)
    expect(container.querySelector('[data-review-count]')).toHaveTextContent('3 reviews')
    expect(screen.getAllByRole('article')).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Load more reviews' }))
    expect(load).toHaveBeenCalledWith({ handle: 'core-hoodie', cursor: 'r2', sort: 'newest' })
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3))
    expect(screen.queryByRole('button', { name: 'Load more reviews' })).not.toBeInTheDocument()
  })

  it('re-sorts from the first page and announces a failure', async () => {
    const load = vi.fn(async () => ({ ok: false as const, error: 'Nope.' }))
    render(<ReviewList handle="core-hoodie" initial={PAGE} load={load} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort reviews' }), 'highest')
    expect(load).toHaveBeenCalledWith({ handle: 'core-hoodie', cursor: null, sort: 'highest' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.')
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('renders nothing with no reviews', () => {
    const { container } = render(<ReviewList handle="core-hoodie" initial={{ items: [], nextCursor: null, total: 0 }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ReviewForm', () => {
  it('shows a sign-in line to signed-out visitors, returning to the reviews anchor', () => {
    customerState.current = { status: 'signed-out' }
    render(<ReviewForm handle="core-hoodie" productTitle="Core Hoodie" />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/account/login?return_to=${encodeURIComponent('/products/core-hoodie#reviews')}`
    )
    expect(screen.queryByRole('button', { name: 'Submit review' })).not.toBeInTheDocument()
  })

  it('submits the rating, title and comment and shows the moderation notice; tracks review_submitted', async () => {
    const action = vi.fn(async (_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> => {
      expect(formData.get('handle')).toBe('core-hoodie')
      expect(formData.get('productTitle')).toBe('Core Hoodie')
      expect(formData.get('rating')).toBe('4')
      expect(formData.get('comment')).toBe('Thick fleece, honest fit, sized up once.')
      return { status: 'success' }
    })
    const events: unknown[] = []
    const off = onAnalyticsEvent((event) => events.push(event))

    render(<ReviewForm handle="core-hoodie" productTitle="Core Hoodie" action={action} />)
    await userEvent.click(screen.getByRole('radio', { name: /4 stars/ }))
    expect(screen.getByRole('radio', { name: /4 stars/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.type(screen.getByLabelText('Your review'), 'Thick fleece, honest fit, sized up once.')
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }))

    expect(await screen.findByRole('status')).toHaveTextContent(REVIEW_SUCCESS_COPY)
    expect(action).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(events).toContainEqual({ event: 'review_submitted', handle: 'core-hoodie', rating: 4 }))
    off()
  })

  it('shows field errors and keeps typed values after a server-side rejection', async () => {
    const action = vi.fn(async (): Promise<ReviewFormState> => ({
      status: 'error',
      error: 'Please fix the highlighted fields.',
      fieldErrors: { rating: 'Pick a star rating.', comment: 'Tell us a little more — at least 20 characters.' },
      values: { rating: null, title: 'Hm', comment: 'Short' },
    }))
    render(<ReviewForm handle="core-hoodie" productTitle="Core Hoodie" action={action} />)
    await userEvent.type(screen.getByLabelText('Your review'), 'Short')
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((alert) => alert.textContent)).toEqual(
      expect.arrayContaining(['Pick a star rating.', 'Tell us a little more — at least 20 characters.'])
    )
    expect(screen.getByLabelText('Your review')).toHaveValue('Short')
  })

  it('shows the signed-out error with a sign-in link when the action refuses', async () => {
    const action = vi.fn(async (): Promise<ReviewFormState> => ({ status: 'error', error: 'Sign in to write a review.', code: 'SIGNED_OUT' }))
    render(<ReviewForm handle="core-hoodie" productTitle="Core Hoodie" action={action} signedIn />)
    await userEvent.click(screen.getByRole('radio', { name: /5 stars/ }))
    await userEvent.type(screen.getByLabelText('Your review'), 'Thick fleece, honest fit, sized up once.')
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Sign in to write a review.')
    expect(within(alert).getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('ReviewsSection', () => {
  it('anchors at #reviews with summary, list and form', () => {
    render(<ReviewsSection handle="core-hoodie" productTitle="Core Hoodie" summary={SUMMARY} page={PAGE} />)
    const section = document.getElementById('reviews')
    expect(section).toHaveAttribute('data-reviews')
    expect(screen.getByRole('heading', { level: 2, name: 'What people say' })).toBeInTheDocument()
    expect(section?.querySelector('[data-review-count]')).toHaveTextContent('3 reviews')
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeInTheDocument()
  })
})

describe('Textarea', () => {
  it('wires label, hint and error', () => {
    render(<Textarea label="Notes" hint="Be kind." error="Required." />)
    const field = screen.getByLabelText('Notes')
    expect(field.tagName).toBe('TEXTAREA')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2)
    expect(screen.getByRole('alert')).toHaveTextContent('Required.')
  })
})
