import * as React from 'react'
import type { ReviewPage, ReviewSummary as ReviewSummaryData } from '@/lib/storefront/reviews'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { ReviewForm } from './ReviewForm'
import { ReviewList } from './ReviewList'
import { ReviewSummary } from './ReviewSummary'

export const REVIEWS_SECTION_ID = 'reviews'

export interface ReviewsSectionProps {
  handle: string
  productTitle: string
  summary: ReviewSummaryData
  page: ReviewPage
}

/**
 * PDP reviews block (Phase 5, Task 2): summary, list, and the write form.
 * Server Component; the list and form are client islands. `id="reviews"` is the
 * anchor the title-block rating link and the sign-in return URL point at.
 */
export function ReviewsSection({ handle, productTitle, summary, page }: ReviewsSectionProps) {
  return (
    <Section id={REVIEWS_SECTION_ID} tone="paper" aria-labelledby="reviews-heading" data-reviews="">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Eyebrow>Reviews</Eyebrow>
            <Display as="h2" id="reviews-heading" size="md">
              What people say
            </Display>
          </div>
          <ReviewSummary summary={summary} />
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <h3 className="text-sm font-semibold text-ink">Write a review</h3>
            <ReviewForm handle={handle} productTitle={productTitle} returnTo={`/products/${handle}#${REVIEWS_SECTION_ID}`} />
          </div>
        </div>
        <div>
          <ReviewList handle={handle} initial={page} />
        </div>
      </div>
    </Section>
  )
}
