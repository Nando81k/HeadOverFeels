'use client'

/**
 * ReviewReplyView — admin reply composer for a single review.
 *
 * Phase 3 Task 12.
 *
 * Schema reality:
 *  - ReviewReply model does NOT exist. Review has inline adminReply,
 *    adminReplyBy, adminReplyAt fields.
 *  - loadReviewWithReplies() synthesises a 0-or-1 replies array.
 *  - replyToReview() writes to the inline fields.
 *
 * Overwrite behaviour:
 *  - Because the schema supports only ONE reply (inline fields), submitting
 *    a second reply silently overwrites the first.
 *  - TODO (Phase 3.5): show a confirm prompt / "Editing existing reply" hint
 *    when review.replies.length > 0 before allowing submit.
 */

import { useRef, useState, useTransition } from 'react'
import type { ReviewWithReplies } from '@/lib/admin/products'
import { replyToReview } from '@/app/admin/products/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewReplyViewProps {
  review: ReviewWithReplies
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill={i < rating ? '#FF3131' : 'none'}
          stroke={i < rating ? '#FF3131' : 'currentColor'}
          strokeWidth={1.5}
          className="h-4 w-4 text-white/20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewReplyView({ review }: ReviewReplyViewProps) {
  const [body, setBody] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit() {
    setSubmitError(null)
    setSubmitSuccess(false)

    if (!body.trim()) {
      setSubmitError('Reply body is required.')
      return
    }

    startTransition(async () => {
      const result = await replyToReview(review.id, body.trim())
      if (result.ok) {
        setSubmitSuccess(true)
        setBody('')
      } else {
        setSubmitError(result.error ?? 'Unknown error.')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="review-reply-view"
      className="mx-auto max-w-2xl space-y-6"
    >
      {/* ── Review card ───────────────────────────────────────────── */}
      <section
        aria-label="Review details"
        className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{review.customerName}</p>
            <p className="text-xs text-white/40">{formatDate(review.createdAt)}</p>
          </div>
          <StarRating rating={review.rating} />
        </div>

        {review.title && (
          <p className="text-sm font-medium text-white/90">{review.title}</p>
        )}

        <p className="text-sm text-white/70 leading-relaxed">{review.body}</p>

        <div className="border-t border-white/10 pt-3 flex items-center gap-3 text-xs text-white/40">
          <span>
            Product:{' '}
            <span className="text-white/70">{review.productName}</span>
          </span>
          {review.productSku && (
            <>
              <span className="text-white/20">·</span>
              <span className="font-mono">{review.productSku}</span>
            </>
          )}
          <span className="text-white/20">·</span>
          <span
            className={[
              'rounded px-1.5 py-0.5 font-medium uppercase tracking-wide',
              review.status === 'APPROVED'
                ? 'bg-emerald-600/20 text-emerald-400'
                : review.status === 'REJECTED'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-white/10 text-white/60',
            ].join(' ')}
          >
            {review.status}
          </span>
        </div>
      </section>

      {/* ── Existing replies (0 or 1) ─────────────────────────────── */}
      {review.replies.length > 0 && (
        <section aria-label="Existing replies" className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Admin Reply History
          </h2>
          {review.replies.map((reply) => (
            <div
              key={reply.id}
              data-testid="existing-reply"
              className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 space-y-1"
            >
              <div className="flex items-center justify-between text-xs text-white/40">
                <span className="font-medium text-white/60">{reply.authorName}</span>
                <span>{formatDate(reply.createdAt)}</span>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{reply.body}</p>
            </div>
          ))}
        </section>
      )}

      {/* ── Reply composer ────────────────────────────────────────── */}
      <section aria-label="Reply composer" className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {review.replies.length > 0 ? 'Edit Reply' : 'Write a Reply'}
        </h2>

        {/* TODO (Phase 3.5): add confirm prompt when replies.length > 0 */}

        <textarea
          ref={textareaRef}
          aria-label="Reply body"
          placeholder="Write your admin reply…"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isPending}
          className={[
            'w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-white',
            'placeholder:text-white/30 resize-none',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
            isPending ? 'opacity-50 cursor-not-allowed' : '',
            submitError && !body.trim() ? 'border-red-500' : 'border-white/10',
          ].join(' ')}
        />

        {/* Feedback */}
        {submitSuccess && (
          <p
            role="status"
            className="rounded-lg bg-emerald-600/15 px-3 py-2 text-xs font-medium text-emerald-400"
          >
            Reply submitted successfully.
          </p>
        )}
        {submitError && (
          <p
            role="alert"
            className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400"
          >
            {submitError}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className={[
            'rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors',
            'bg-[#FF3131] hover:bg-[#e02020]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
            isPending ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {isPending ? 'Submitting…' : 'Submit Reply'}
        </button>
      </section>
    </div>
  )
}
