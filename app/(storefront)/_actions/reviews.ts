'use server'

import { z } from 'zod'

import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { getCustomerSession } from '@/lib/shopify/customer/session'
import type { StorefrontActionResult } from '@/lib/shopify/types'
import {
  REVIEW_COMMENT_MAX,
  REVIEW_COMMENT_MIN,
  REVIEW_GENERIC_ERROR as GENERIC_ERROR,
  REVIEW_SIGNED_OUT_ERROR,
  REVIEW_TITLE_MAX,
  REVIEW_UNAVAILABLE_ERROR,
  type ReviewFormState,
} from '@/lib/storefront/review-form'
import {
  createReview,
  listReviews,
  ReviewError,
  type ReviewPage,
  type ReviewSort,
} from '@/lib/storefront/reviews'

/**
 * Review Server Actions (Phase 5, Task 2). Rules (plan, cross-cutting notes 5, 6, 8):
 * - Accounts unconfigured or signed out → the form shows its sign-in line; the
 *   action answers `SIGNED_OUT` so a stale page cannot post anonymously.
 * - Every review lands `PENDING`; nothing here revalidates the PDP.
 * - Never throws to the client; unexpected failures are logged by message only.
 * - Only async functions may be exported here; the state type and copy live in
 *   `lib/storefront/review-form.ts`.
 */

const submitSchema = z.object({
  handle: z.string().trim().min(1).max(255),
  productTitle: z.string().trim().min(1).max(255),
  rating: z.preprocess(
    (value) => (value === undefined || value === '' ? undefined : Number(value)),
    z.number({ error: 'Pick a star rating.' }).int().min(1, 'Pick a star rating.').max(5, 'Pick a star rating.')
  ),
  title: z.string().trim().max(REVIEW_TITLE_MAX, `Keep the title under ${REVIEW_TITLE_MAX} characters.`).optional(),
  comment: z
    .string()
    .trim()
    .min(REVIEW_COMMENT_MIN, `Tell us a little more — at least ${REVIEW_COMMENT_MIN} characters.`)
    .max(REVIEW_COMMENT_MAX, `Keep it under ${REVIEW_COMMENT_MAX} characters.`),
  /** Honeypot: humans never see it; a value means a bot. */
  website: z.string().max(0).optional(),
})

const listSchema = z.object({
  handle: z.string().trim().min(1).max(255),
  cursor: z.string().trim().min(1).max(255).nullish(),
  sort: z.enum(['newest', 'highest', 'lowest', 'helpful']).optional(),
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export async function submitReviewAction(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const values = {
    rating: field(formData, 'rating') ? Number(field(formData, 'rating')) : null,
    title: field(formData, 'title'),
    comment: field(formData, 'comment'),
  }

  if (!hasCustomerAccountEnv()) {
    return { status: 'error', error: REVIEW_UNAVAILABLE_ERROR, code: 'UNAVAILABLE', values }
  }
  const session = await getCustomerSession()
  if (!session) return { status: 'error', error: REVIEW_SIGNED_OUT_ERROR, code: 'SIGNED_OUT', values }

  const parsed = submitSchema.safeParse({
    handle: field(formData, 'handle'),
    productTitle: field(formData, 'productTitle'),
    rating: field(formData, 'rating') || undefined,
    title: field(formData, 'title') || undefined,
    comment: field(formData, 'comment'),
    website: field(formData, 'website') || undefined,
  })
  if (!parsed.success) {
    const fieldErrors: ReviewFormState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'rating' || key === 'title' || key === 'comment') fieldErrors[key] ??= issue.message
    }
    // A tripped honeypot or a bad handle gets the generic refusal, not a hint.
    if (Object.keys(fieldErrors).length === 0) return { status: 'error', error: GENERIC_ERROR, values }
    return { status: 'error', error: 'Please fix the highlighted fields.', fieldErrors, values }
  }

  try {
    await createReview(
      {
        handle: parsed.data.handle,
        productTitle: parsed.data.productTitle,
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        comment: parsed.data.comment,
      },
      session
    )
    return { status: 'success' }
  } catch (error) {
    if (error instanceof ReviewError) return { status: 'error', error: error.message, code: error.code, values }
    console.error(`[storefront] review submit failed: ${errorMessage(error)}`)
    return { status: 'error', error: GENERIC_ERROR, values }
  }
}

export async function listReviewsAction(input: {
  handle: string
  cursor: string | null
  sort?: ReviewSort
}): Promise<StorefrontActionResult<ReviewPage>> {
  const parsed = listSchema.safeParse(input ?? {})
  if (!parsed.success) return { ok: false, error: 'No more reviews to load.', code: 'INVALID_INPUT' }
  try {
    return {
      ok: true,
      data: await listReviews(parsed.data.handle, { cursor: parsed.data.cursor ?? null, sort: parsed.data.sort }),
    }
  } catch (error) {
    console.error(`[storefront] review list failed: ${errorMessage(error)}`)
    return { ok: false, error: GENERIC_ERROR }
  }
}
