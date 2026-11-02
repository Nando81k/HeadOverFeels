/**
 * Review form contract shared by the Server Action and the client form
 * (Phase 5, Task 2). Lives outside the `'use server'` module because that file
 * may only export async functions.
 */

export type ReviewFormState = {
  status: 'idle' | 'success' | 'error'
  error?: string
  code?: string
  fieldErrors?: Partial<Record<'rating' | 'title' | 'comment', string>>
  /** Echoed back so the form can keep what was typed after a server error. */
  values?: { rating: number | null; title: string; comment: string }
}

export const REVIEW_FORM_IDLE: ReviewFormState = { status: 'idle' }

export const REVIEW_SIGNED_OUT_ERROR = 'Sign in to write a review.'
export const REVIEW_UNAVAILABLE_ERROR = 'Reviews are unavailable right now.'
export const REVIEW_GENERIC_ERROR = 'Something went wrong. Please try again.'

export const REVIEW_TITLE_MAX = 120
export const REVIEW_COMMENT_MIN = 20
export const REVIEW_COMMENT_MAX = 2000
