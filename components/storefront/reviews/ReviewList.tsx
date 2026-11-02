'use client'

import * as React from 'react'
import { listReviewsAction } from '@/app/(storefront)/_actions/reviews'
import type { StorefrontActionResult } from '@/lib/shopify/types'
import type { ReviewItem, ReviewPage, ReviewSort } from '@/lib/storefront/reviews'
import { Button } from '@/components/storefront/ui/Button'
import { Select } from '@/components/storefront/ui/Select'
import { ReviewCard } from './ReviewCard'

export interface ReviewListProps {
  handle: string
  /** First page, rendered on the server with the PDP. */
  initial: ReviewPage
  /** Injectable for tests; defaults to the Server Action. */
  load?: (input: { handle: string; cursor: string | null; sort?: ReviewSort }) => Promise<StorefrontActionResult<ReviewPage>>
}

export const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
  { value: 'helpful', label: 'Most helpful' },
]

/**
 * Paginated review list. The first page comes from the server; "Load more" and
 * re-sorting call `listReviewsAction`. Failures keep what is on screen and
 * announce the error.
 */
export function ReviewList({ handle, initial, load = listReviewsAction }: ReviewListProps) {
  const [items, setItems] = React.useState<ReviewItem[]>(initial.items)
  const [cursor, setCursor] = React.useState<string | null>(initial.nextCursor)
  const [sort, setSort] = React.useState<ReviewSort>('newest')
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchPage = async (nextSort: ReviewSort, nextCursor: string | null) => {
    setPending(true)
    setError(null)
    try {
      const result = await load({ handle, cursor: nextCursor, sort: nextSort })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setItems((current) => (nextCursor ? [...current, ...result.data.items] : result.data.items))
      setCursor(result.data.nextCursor)
    } catch {
      setError('Could not load reviews. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const onSort = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as ReviewSort
    setSort(next)
    void fetchPage(next, null)
  }

  if (initial.total === 0 && items.length === 0) return null

  return (
    <div data-review-list="" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p data-review-count="" className="text-sm text-ink-soft">
          <span className="num">{initial.total}</span> {initial.total === 1 ? 'review' : 'reviews'}
        </p>
        <Select
          label="Sort reviews"
          hideLabel
          value={sort}
          onChange={onSort}
          disabled={pending}
          wrapperClassName="w-44"
          className="h-10 text-xs"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div aria-busy={pending || undefined} className="flex flex-col gap-5">
        {items.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}

      {cursor ? (
        <div className="flex justify-center border-t border-line pt-5">
          <Button
            type="button"
            variant="outline"
            size="md"
            loading={pending}
            onClick={() => void fetchPage(sort, cursor)}
          >
            Load more reviews
          </Button>
        </div>
      ) : null}
    </div>
  )
}
