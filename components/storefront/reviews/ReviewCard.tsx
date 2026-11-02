import * as React from 'react'
import type { ReviewItem } from '@/lib/storefront/reviews'
import { cn } from '@/lib/storefront/cn'
import { Stars } from './Stars'

export interface ReviewCardProps extends React.HTMLAttributes<HTMLElement> {
  review: ReviewItem
  /** Shown under the author on the home strip. */
  productLabel?: { title: string; href: string } | null
}

export function formatReviewDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

/** One review (server-safe). */
export function ReviewCard({ review, productLabel = null, className, ...props }: ReviewCardProps) {
  return (
    <article
      data-review-id={review.id}
      className={cn('flex flex-col gap-3 border-t border-line pt-5', className)}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars rating={review.rating} size="sm" />
        <time dateTime={review.createdAt} className="text-xs text-ink-mute">
          {formatReviewDate(review.createdAt)}
        </time>
      </div>
      {review.title ? <h3 className="text-base font-semibold text-ink">{review.title}</h3> : null}
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{review.comment}</p>
      <p className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
        <span className="font-medium text-ink">{review.authorName}</span>
        {review.isVerified ? (
          <span
            data-verified=""
            className="inline-flex items-center gap-1 text-ok before:inline-block before:size-1.5 before:rounded-full before:bg-ok"
          >
            Verified purchase
          </span>
        ) : null}
        {productLabel ? (
          <>
            <span aria-hidden="true">·</span>
            <a href={productLabel.href} className="underline-offset-4 hover:underline">
              {productLabel.title}
            </a>
          </>
        ) : null}
      </p>
      {review.adminReply ? (
        <div data-admin-reply="" className="border-l-2 border-line-strong pl-4 text-sm text-ink-soft">
          <p className="mb-1 text-xs font-semibold uppercase tracking-eyebrow text-ink-soft">Head Over Feels</p>
          <p className="whitespace-pre-line leading-relaxed">{review.adminReply}</p>
        </div>
      ) : null}
    </article>
  )
}
