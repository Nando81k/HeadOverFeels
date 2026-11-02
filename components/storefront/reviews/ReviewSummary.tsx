import * as React from 'react'
import type { Rating, ReviewSummary as ReviewSummaryData } from '@/lib/storefront/reviews'
import { Stars } from './Stars'

export interface ReviewSummaryProps {
  summary: ReviewSummaryData
}

const ROWS: Rating[] = [5, 4, 3, 2, 1]

/** Average, count and the per-star histogram (server-safe). */
export function ReviewSummary({ summary }: ReviewSummaryProps) {
  if (summary.count === 0) {
    return (
      <p data-review-summary="empty" className="text-sm text-ink-soft">
        No reviews yet. Be the first to share how it fits.
      </p>
    )
  }
  const average = Number(summary.average.toFixed(1))
  return (
    <div data-review-summary="" className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-10">
      <div className="flex flex-col gap-2">
        <p className="font-display text-5xl leading-none tracking-tight text-ink num">{average.toFixed(1)}</p>
        <Stars rating={summary.average} size="lg" />
        <p className="text-xs text-ink-mute">
          Based on <span className="num">{summary.count}</span> {summary.count === 1 ? 'review' : 'reviews'}
        </p>
      </div>
      <ul className="flex w-full max-w-xs flex-col gap-1.5" aria-label="Rating breakdown">
        {ROWS.map((star) => {
          const n = summary.distribution[star]
          const pct = summary.count > 0 ? Math.round((n / summary.count) * 100) : 0
          return (
            <li key={star} className="flex items-center gap-3 text-xs text-ink-soft">
              <span className="w-10 shrink-0 num">{star} star</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-sharp bg-line" aria-hidden="true">
                <span className="block h-full bg-ink" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-6 text-right num" aria-label={`${n} ${n === 1 ? 'review' : 'reviews'}`}>
                {n}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
