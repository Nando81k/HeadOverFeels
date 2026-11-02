'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  REVIEW_COMMENT_MAX,
  REVIEW_COMMENT_MIN,
  REVIEW_FORM_IDLE,
  REVIEW_TITLE_MAX,
  submitReviewAction,
  type ReviewFormState,
} from '@/app/(storefront)/_actions/reviews'
import { track } from '@/lib/storefront/analytics'
import { cn } from '@/lib/storefront/cn'
import { useCustomerOptional } from '@/components/storefront/account/useCustomer'
import { Button } from '@/components/storefront/ui/Button'
import { Input } from '@/components/storefront/ui/Input'
import { fieldErrorClass, fieldLabelClass } from '@/components/storefront/ui/Input'
import { Textarea } from '@/components/storefront/ui/Textarea'
import { Star } from './Stars'

export const REVIEW_SUCCESS_COPY = 'Thanks — your review is in moderation and will appear once approved.'

export interface ReviewFormProps {
  handle: string
  productTitle: string
  /** Where the sign-in link returns to; defaults to the PDP's `#reviews`. */
  returnTo?: string
  /** Injectable for tests; defaults to the Server Action. */
  action?: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>
  /** Force the signed-in/out state (otherwise read from `CustomerProvider`). */
  signedIn?: boolean
}

const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Love it'] as const

/**
 * Write-a-review form (Phase 5, Task 2). Signed-out visitors see a sign-in
 * line instead of the fields; the Server Action enforces the same rule. On
 * success the form is replaced by the moderation notice and `review_submitted`
 * is tracked once.
 */
export function ReviewForm({ handle, productTitle, returnTo, action = submitReviewAction, signedIn }: ReviewFormProps) {
  const customer = useCustomerOptional()
  const [state, formAction, pending] = React.useActionState(action, REVIEW_FORM_IDLE)
  const [rating, setRating] = React.useState<number>(state.values?.rating ?? 0)
  const [hover, setHover] = React.useState(0)
  const ratingId = React.useId()

  const status = customer?.status
  const isSignedIn = signedIn ?? status === 'ready'
  const unknown = signedIn === undefined && (status === undefined || status === 'loading')
  const loginHref = `/account/login?return_to=${encodeURIComponent(returnTo ?? `/products/${handle}#reviews`)}`

  React.useEffect(() => {
    if (state.status === 'success') track({ event: 'review_submitted', handle, rating })
    // Fire once per success transition; `rating` is the value that was submitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status])

  if (state.status === 'success') {
    return (
      <p role="status" data-review-form="success" className="rounded-sharp border border-line bg-paper p-5 text-sm text-ink-soft">
        {REVIEW_SUCCESS_COPY}
      </p>
    )
  }

  if (!isSignedIn && !unknown) {
    return (
      <p data-review-form="signed-out" className="text-sm text-ink-soft">
        <Link href={loginHref} className="font-medium text-ink underline underline-offset-4">
          Sign in
        </Link>{' '}
        to write a review.
      </p>
    )
  }

  const shown = hover || rating
  const ratingError = state.fieldErrors?.rating

  return (
    <form action={formAction} data-review-form="" className="flex flex-col gap-5" aria-busy={pending || undefined}>
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="productTitle" value={productTitle} />
      <input type="hidden" name="rating" value={rating || ''} />
      {/* Honeypot: hidden from people, filled by bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`${ratingId}-website`}>Website</label>
        <input id={`${ratingId}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby={ratingError ? `${ratingId}-error` : undefined}>
        <legend className={fieldLabelClass}>Your rating</legend>
        <div className="flex items-center gap-2" onMouseLeave={() => setHover(0)}>
          <div role="radiogroup" aria-label="Rating" className="flex gap-1">
            {RATING_LABELS.map((label, index) => {
              const value = index + 1
              const active = value <= shown
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} ${value === 1 ? 'star' : 'stars'} — ${label}`}
                  data-rating-option={value}
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHover(value)}
                  onFocus={() => setHover(value)}
                  onBlur={() => setHover(0)}
                  className={cn(
                    'rounded-sharp p-0.5 transition-colors duration-sf-fast ease-sf-out',
                    'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
                    active ? 'text-signal' : 'text-line-strong hover:text-ink-mute'
                  )}
                >
                  <Star className="size-7" />
                </button>
              )
            })}
          </div>
          <span className="text-xs text-ink-mute" aria-live="polite">
            {shown ? RATING_LABELS[shown - 1] : ''}
          </span>
        </div>
        {ratingError ? (
          <p id={`${ratingId}-error`} role="alert" className={fieldErrorClass}>
            {ratingError}
          </p>
        ) : null}
      </fieldset>

      <Input
        label="Title (optional)"
        name="title"
        maxLength={REVIEW_TITLE_MAX}
        defaultValue={state.values?.title ?? ''}
        error={state.fieldErrors?.title}
        autoComplete="off"
      />

      <Textarea
        label="Your review"
        name="comment"
        required
        minLength={REVIEW_COMMENT_MIN}
        maxLength={REVIEW_COMMENT_MAX}
        defaultValue={state.values?.comment ?? ''}
        error={state.fieldErrors?.comment}
        hint={`How does it fit? How is the weight? ${REVIEW_COMMENT_MIN}–${REVIEW_COMMENT_MAX} characters.`}
      />

      {state.status === 'error' && !state.fieldErrors ? (
        <p role="alert" className={fieldErrorClass}>
          {state.error}
          {state.code === 'SIGNED_OUT' ? (
            <>
              {' '}
              <Link href={loginHref} className="underline underline-offset-4">
                Sign in
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="md" loading={pending} disabled={unknown}>
          Submit review
        </Button>
        <p className="text-xs text-ink-mute">Reviews are checked before they go live.</p>
      </div>
    </form>
  )
}
