import { describe, expect, it } from 'vitest'
import {
  buildReviewSummary,
  mergePrimaryWithFallback,
  normalizeReviewHighlights,
  parseImageList,
} from '@/lib/home/homepage-data'
import type { HomeProductCard } from '@/components/home/types'

function makeProduct(id: string): HomeProductCard {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    price: 50,
    compareAtPrice: null,
    imageUrl: '/img.jpg',
    isSoldOut: false,
    colorCues: [],
  }
}

describe('homepage data helpers', () => {
  it('fills deterministic fallback order without duplicates', () => {
    const primary = [makeProduct('2'), makeProduct('1')]
    const fallback = [makeProduct('1'), makeProduct('3'), makeProduct('4')]

    const result = mergePrimaryWithFallback(primary, fallback, 3)

    expect(result.map((product) => product.id)).toEqual(['2', '1', '3'])
  })

  it('normalizes image payloads and guards malformed payloads', () => {
    expect(parseImageList('https://cdn.test/pdp.jpg')).toEqual(['https://cdn.test/pdp.jpg'])
    expect(parseImageList('[{"url":"/first.jpg"},"/second.jpg"]')).toEqual(['/first.jpg', '/second.jpg'])
    expect(parseImageList('{"url":"/single.jpg"}')).toEqual(['/single.jpg'])
    expect(parseImageList('[{"broken"]')).toEqual([])
  })

  it('handles no-review and low-review highlight states safely', () => {
    expect(buildReviewSummary(null, 0)).toEqual({ averageRating: 0, totalReviews: 0 })

    expect(normalizeReviewHighlights([], 3)).toEqual([])

    const highlights = normalizeReviewHighlights([
      {
        id: 'review-1',
        rating: 5,
        customerName: 'Alex',
        comment: 'Great fit and great quality.',
        product: {
          name: 'Calm Hoodie',
          slug: 'calm-hoodie',
        },
      },
    ])

    expect(highlights).toHaveLength(1)
    expect(highlights[0]).toMatchObject({
      id: 'review-1',
      rating: 5,
      productName: 'Calm Hoodie',
      productSlug: 'calm-hoodie',
      customerName: 'Alex',
      snippet: 'Great fit and great quality.',
    })
  })
})
