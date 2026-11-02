// tests/unit/storefront/reviews-actions.test.ts — app/(storefront)/_actions/reviews.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { env, session, reviews } = vi.hoisted(() => ({
  env: { hasCustomerAccountEnv: vi.fn(() => true) },
  session: { getCustomerSession: vi.fn() },
  reviews: {
    createReview: vi.fn(),
    listReviews: vi.fn(),
    ReviewError: class ReviewError extends Error {
      code: string
      constructor(code: string, message: string) {
        super(message)
        this.code = code
      }
    },
  },
}))

vi.mock('@/lib/shopify/customer/env', () => env)
vi.mock('@/lib/shopify/customer/session', () => session)
vi.mock('@/lib/storefront/reviews', () => reviews)

import { listReviewsAction, submitReviewAction } from '@/app/(storefront)/_actions/reviews'
import { REVIEW_FORM_IDLE, REVIEW_SIGNED_OUT_ERROR, REVIEW_UNAVAILABLE_ERROR } from '@/lib/storefront/review-form'

const SESSION = { customerId: 'gid://shopify/Customer/1', email: 'n@example.com' }

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const VALID = {
  handle: 'core-hoodie',
  productTitle: 'Core Hoodie',
  rating: '5',
  title: 'Heavy in the best way',
  comment: 'The fleece is thick and the fit is honest. Sized up once.',
}

beforeEach(() => {
  vi.clearAllMocks()
  env.hasCustomerAccountEnv.mockReturnValue(true)
  session.getCustomerSession.mockResolvedValue(SESSION)
  reviews.createReview.mockResolvedValue({ id: 'r1', status: 'PENDING', isVerified: false })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('submitReviewAction', () => {
  it('creates the review and reports success', async () => {
    const state = await submitReviewAction(REVIEW_FORM_IDLE, form(VALID))
    expect(state).toEqual({ status: 'success' })
    expect(reviews.createReview).toHaveBeenCalledWith(
      { handle: 'core-hoodie', productTitle: 'Core Hoodie', rating: 5, title: 'Heavy in the best way', comment: VALID.comment },
      SESSION
    )
  })

  it('answers SIGNED_OUT without touching the database', async () => {
    session.getCustomerSession.mockResolvedValue(null)
    const state = await submitReviewAction(REVIEW_FORM_IDLE, form(VALID))
    expect(state).toMatchObject({ status: 'error', code: 'SIGNED_OUT', error: REVIEW_SIGNED_OUT_ERROR })
    expect(state.values).toEqual({ rating: 5, title: VALID.title, comment: VALID.comment })
    expect(reviews.createReview).not.toHaveBeenCalled()
  })

  it('answers UNAVAILABLE when accounts are not configured', async () => {
    env.hasCustomerAccountEnv.mockReturnValue(false)
    await expect(submitReviewAction(REVIEW_FORM_IDLE, form(VALID))).resolves.toMatchObject({
      code: 'UNAVAILABLE',
      error: REVIEW_UNAVAILABLE_ERROR,
    })
    expect(session.getCustomerSession).not.toHaveBeenCalled()
  })

  it('returns field errors for a missing rating and a short comment', async () => {
    const state = await submitReviewAction(REVIEW_FORM_IDLE, form({ ...VALID, rating: '', comment: 'Too short' }))
    expect(state.status).toBe('error')
    expect(state.fieldErrors?.rating).toBe('Pick a star rating.')
    expect(state.fieldErrors?.comment).toMatch(/at least 20/)
    expect(reviews.createReview).not.toHaveBeenCalled()
  })

  it('rejects a title over 120 characters', async () => {
    const state = await submitReviewAction(REVIEW_FORM_IDLE, form({ ...VALID, title: 'x'.repeat(121) }))
    expect(state.fieldErrors?.title).toMatch(/120/)
  })

  it('treats a filled honeypot as a generic failure', async () => {
    const state = await submitReviewAction(REVIEW_FORM_IDLE, form({ ...VALID, website: 'http://spam' }))
    expect(state).toMatchObject({ status: 'error', error: 'Something went wrong. Please try again.' })
    expect(state.fieldErrors).toBeUndefined()
    expect(reviews.createReview).not.toHaveBeenCalled()
  })

  it('surfaces ALREADY_REVIEWED from the data layer', async () => {
    reviews.createReview.mockRejectedValue(new reviews.ReviewError('ALREADY_REVIEWED', 'You have already reviewed this product.'))
    await expect(submitReviewAction(REVIEW_FORM_IDLE, form(VALID))).resolves.toMatchObject({
      status: 'error',
      code: 'ALREADY_REVIEWED',
      error: 'You have already reviewed this product.',
    })
  })

  it('never throws on an unexpected failure', async () => {
    reviews.createReview.mockRejectedValue(new Error('db down'))
    await expect(submitReviewAction(REVIEW_FORM_IDLE, form(VALID))).resolves.toMatchObject({
      status: 'error',
      error: 'Something went wrong. Please try again.',
    })
    expect(console.error).toHaveBeenCalled()
  })
})

describe('listReviewsAction', () => {
  it('returns the page from the data layer', async () => {
    const page = { items: [], nextCursor: null, total: 0 }
    reviews.listReviews.mockResolvedValue(page)
    await expect(listReviewsAction({ handle: 'core-hoodie', cursor: 'r2', sort: 'highest' })).resolves.toEqual({
      ok: true,
      data: page,
    })
    expect(reviews.listReviews).toHaveBeenCalledWith('core-hoodie', { cursor: 'r2', sort: 'highest' })
  })

  it('rejects bad input and swallows failures', async () => {
    await expect(listReviewsAction({ handle: '', cursor: null })).resolves.toMatchObject({ ok: false, code: 'INVALID_INPUT' })
    reviews.listReviews.mockRejectedValue(new Error('down'))
    await expect(listReviewsAction({ handle: 'core-hoodie', cursor: null })).resolves.toMatchObject({ ok: false })
  })
})
