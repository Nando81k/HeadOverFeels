import * as React from 'react'
import type { HomeReview } from '@/lib/storefront/reviews'
import { Reveal } from '@/components/storefront/motion/Reveal'
import { ReviewCard } from '@/components/storefront/reviews/ReviewCard'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

export interface ReviewsStripProps {
  reviews: HomeReview[]
}

/**
 * Home social proof (Phase 5, Task 2): the newest glowing reviews across the
 * catalogue. Renders nothing when there are none, so the unconfigured home
 * page and a fresh store look the same as before.
 */
export function ReviewsStrip({ reviews }: ReviewsStripProps) {
  if (reviews.length === 0) return null
  return (
    <Section aria-labelledby="home-reviews" data-reviews-strip="">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Eyebrow>Reviews</Eyebrow>
          <Display as="h2" id="home-reviews" size="md">
            Worn and reviewed
          </Display>
        </div>
        <ul className="grid gap-gutter md:grid-cols-3">
          {reviews.map((review, index) => (
            <Reveal as="li" key={review.id} delay={index * 60}>
              <ReviewCard
                review={review}
                className="h-full border-t-0 border-l border-line pl-5 pt-0"
                productLabel={{
                  title: review.productTitle ?? 'View product',
                  href: `/products/${review.productHandle}#reviews`,
                }}
              />
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  )
}
